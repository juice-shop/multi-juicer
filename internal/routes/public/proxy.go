package public

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/teamcookie"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// lastRequestWriteInterval is how often the lastRequest annotation is refreshed
// per team and replica.
const lastRequestWriteInterval = 1 * time.Minute

var (
	lastRequestWrites = map[string]int64{}
	cacheMutex        = &sync.Mutex{}
)

func clearLastRequestWriteCache() {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()
	lastRequestWrites = map[string]int64{}
}

// newReverseProxy creates a reverse proxy for a given target URL.
func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL: %v", err)
	}
	return httputil.NewSingleHostReverseProxy(url)
}

// HandleProxy determines the JuiceShop instance of the Team based on the team cookie and proxies the request to the corresponding JuiceShop instance.
func handleProxy(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil {
				// nosemgrep: go.lang.security.audit.net.cookie-missing-secure.cookie-missing-secure
				http.SetCookie(responseWriter, &http.Cookie{Name: bundle.Config.CookieConfig.Name, Path: "/", MaxAge: -1, HttpOnly: true, SameSite: http.SameSiteStrictMode, Secure: bundle.Config.CookieConfig.Secure})
				http.Redirect(responseWriter, req, "/multi-juicer", http.StatusFound)
				return
			}

			switch resolveInstanceStatus(req.Context(), bundle, team) {
			case instanceMissing:
				bundle.Log.Info("Instance for team is missing. Redirecting to multi-juicer landing page.", "team", team)
				http.Redirect(responseWriter, req, fmt.Sprintf("/multi-juicer/?msg=instance-not-found&team=%s", team), http.StatusFound)
				return
			case instanceDown:
				bundle.Log.Info("Instance for team is down. Redirecting to multi-juicer landing page.", "team", team)
				http.Redirect(responseWriter, req, fmt.Sprintf("/multi-juicer/?msg=instance-restarting&team=%s", team), http.StatusFound)
				return
			}

			touchLastRequestTimestamp(req.Context(), bundle, team)

			target := bundle.GetJuiceShopUrlForTeam(team, bundle)
			bundle.Log.Debug("Proxying request", "team", team, "method", req.Method, "path", req.URL)
			// Rewrite the request to the target server
			newReverseProxy(target).ServeHTTP(responseWriter, req)
		},
	)
}

// claimLastRequestWrite reports whether this request should refresh the
// lastRequest annotation for the team. The claim is recorded before the patch
// is sent, so concurrent requests for the same team don't each issue their own.
func claimLastRequestWrite(team string) bool {
	cacheMutex.Lock()
	defer cacheMutex.Unlock()

	now := time.Now().UnixMilli()
	if lastWrite, ok := lastRequestWrites[team]; ok && lastWrite > now-lastRequestWriteInterval.Milliseconds() {
		return false
	}
	lastRequestWrites[team] = now
	return true
}

type instanceStatus string

const (
	instanceUp      instanceStatus = "up"
	instanceDown    instanceStatus = "down"
	instanceMissing instanceStatus = "missing"
)

// resolveInstanceStatus determines whether the team's JuiceShop can be proxied to.
// answering from cache only to keep kubernetes api calls out of the request path entirely
// Only teams the watcher hasn't seen yet fall back to a direct lookup.
func resolveInstanceStatus(context context.Context, bundle *bundle.Bundle, team string) instanceStatus {
	if bundle.ScoringService != nil {
		if ready, known := bundle.ScoringService.GetInstanceReadiness(team); known {
			if ready {
				return instanceUp
			}
			return instanceDown
		}
	}
	return lookupInstanceStatusInKubernetesApi(context, bundle, team)
}

func lookupInstanceStatusInKubernetesApi(context context.Context, bundle *bundle.Bundle, team string) instanceStatus {
	deployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(context, fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})

	switch {
	case errors.IsNotFound(err):
		return instanceMissing
	case err != nil:
		bundle.Log.Error("Failed to lookup if an instance is up in the kubernetes api. Assuming it's missing.", "error", err)
		return instanceMissing
	case deployment.Status.ReadyReplicas < 1:
		return instanceDown
	default:
		return instanceUp
	}
}

// touchLastRequestTimestamp keeps the annotation the inactivity cleaner reads up
// to date. Best effort: a failure here must not stop us from proxying.
func touchLastRequestTimestamp(context context.Context, bundle *bundle.Bundle, team string) {
	if !claimLastRequestWrite(team) {
		return
	}
	if err := updateLastRequestTimestamp(context, bundle, team); err != nil {
		bundle.Log.Warn("failed to update last request time stamp on deployment. last request timestamps shown on the admin page might be out of sync.", "team", team, "error", err)
	}
}

type UpdateProgressDeploymentDiff struct {
	Metadata UpdateProgressDeploymentMetadata `json:"metadata"`
}

// UpdateProgressDeploymentMetadata a shim of the k8s metadata object containing only annotations
type UpdateProgressDeploymentMetadata struct {
	Annotations UpdateProgressDeploymentDiffAnnotations `json:"annotations"`
}

// UpdateProgressDeploymentDiffAnnotations the app specific annotations relevant to the `progress-watchdog`
type UpdateProgressDeploymentDiffAnnotations struct {
	LastRequest         string `json:"multi-juicer.owasp-juice.shop/lastRequest"`
	LastRequestReadable string `json:"multi-juicer.owasp-juice.shop/lastRequestReadable"`
}

func updateLastRequestTimestamp(context context.Context, bundle *bundle.Bundle, team string) error {
	bundle.Log.Debug("Updating last request timestamp", "team", team)

	diff := UpdateProgressDeploymentDiff{
		Metadata: UpdateProgressDeploymentMetadata{
			Annotations: UpdateProgressDeploymentDiffAnnotations{
				LastRequest:         fmt.Sprintf("%d", time.Now().UnixMilli()),
				LastRequestReadable: time.Now().String(),
			},
		},
	}

	jsonBytes, err := json.Marshal(diff)
	if err != nil {
		return fmt.Errorf("could not encode json, to update lastRequest timestamp on deployment")
	}

	_, err = bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Patch(context, fmt.Sprintf("juiceshop-%s", team), types.MergePatchType, jsonBytes, metav1.PatchOptions{})

	if err != nil {
		return fmt.Errorf("failed to last request timestamp for deployment. %w", err)
	}
	return nil
}
