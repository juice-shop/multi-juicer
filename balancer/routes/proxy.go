package routes

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	instanceUpCache = map[string]int64{}
	cacheMutex      = &sync.Mutex{}
)

func clearInstanceUpCache() {
	instanceUpCache = map[string]int64{}
}

// newReverseProxy creates a reverse proxy for a given target URL.
func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL: %v", err)
	}
	return httputil.NewSingleHostReverseProxy(url)
}

// HandleProxy determines the JuiceShop instance of the Team based on the "balancer" cookie and proxies the request to the corresponding JuiceShop instance.
func handleProxy(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil {
				http.SetCookie(responseWriter, &http.Cookie{Name: "balancer", Path: "/", MaxAge: -1})
				http.Redirect(responseWriter, req, "/balancer", http.StatusFound)
				return
			}

			if !wasInstanceUptimeStatusCheckedRecently(team) {
				status := isInstanceUp(req.Context(), bundle, team)
				if status == instanceUp {
					cacheMutex.Lock()
					instanceUpCache[team] = time.Now().UnixMilli()
					cacheMutex.Unlock()
				} else if status == instanceMissing {
					bundle.Log.Printf("Instance for team (%s) is missing. Redirecting to balancer page.", team)
					http.Redirect(responseWriter, req, fmt.Sprintf("/balancer/?msg=instance-not-found&teamname=%s", team), http.StatusFound)
					return
				} else {
					bundle.Log.Printf("Instance for team (%s) is down. Redirecting to balancer page.", team)
					http.Redirect(responseWriter, req, fmt.Sprintf("/balancer/?msg=instance-restarting&teamname=%s", team), http.StatusFound)
					return
				}
			}

			target := bundle.GetJuiceShopUrlForTeam(team, bundle)
			bundle.Log.Printf("Proxying request for team (%s): %s %s to %s", team, req.Method, req.URL, target)
			// Rewrite the request to the target server
			newReverseProxy(target).ServeHTTP(responseWriter, req)
		},
	)
}

// checks if the instance uptime status was checked in the last ten seconds by looking into the instanceUpCache
func wasInstanceUptimeStatusCheckedRecently(team string) bool {
	lastConnect, ok := instanceUpCache[team]
	return ok && lastConnect > time.Now().Add(-10*time.Second).UnixMilli()
}

type instanceStatus string

const (
	instanceUp      instanceStatus = "up"
	instanceDown    instanceStatus = "down"
	instanceMissing instanceStatus = "missing"
)

func isInstanceUp(context context.Context, bundle *bundle.Bundle, team string) instanceStatus {
	deployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(context, fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})

	if errors.IsNotFound(err) {
		return instanceMissing
	} else if err != nil {
		bundle.Log.Printf("Failed to lookup if a instance is up in the kubernetes api. Assuming it's missing: %s", err)
		return instanceMissing
	} else if deployment.Status.ReadyReplicas > 0 {
		return instanceUp
	}
	return instanceDown
}
