package proxy

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
)

// newReverseProxy creates a reverse proxy for a given target URL.
func newReverseProxy(target string) *httputil.ReverseProxy {
	url, err := url.Parse(target)
	if err != nil {
		log.Fatalf("Failed to parse target URL: %v", err)
	}
	return httputil.NewSingleHostReverseProxy(url)
}

// HandleProxy determines the JuiceShop instance of the Team based on the "balancer" cookie and proxies the request to the corresponding JuiceShop instance.
func HandleProxy(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			teamSigned, err := req.Cookie("balancer")
			if err != nil {
				http.SetCookie(responseWriter, &http.Cookie{Name: "balancer", Path: "/", Expires: time.Now().Add(-100000 * time.Second)})
				http.Redirect(responseWriter, req, "/balancer", http.StatusFound)
				return
			}
			team, err := signutil.Unsign(teamSigned.Value, bundle.Config.CookieConfig.SigningKey)
			if err != nil {
				bundle.Log.Printf("Invalid cookie signature, unsetting cookie and redirecting to balancer page.")
				http.SetCookie(responseWriter, &http.Cookie{Name: "balancer", Path: "/", Expires: time.Now().Add(-100000 * time.Second)})
				http.Redirect(responseWriter, req, "/balancer", http.StatusFound)
				return
			}
			if team == "" {
				bundle.Log.Printf("Empty team in signed cookie! Unsetting cookie and redirecting to balancer page.")
				http.SetCookie(responseWriter, &http.Cookie{Name: "balancer", Path: "/", Expires: time.Now().Add(-100000 * time.Second)})
				http.Redirect(responseWriter, req, "/balancer", http.StatusFound)
				return
			}

			target := fmt.Sprintf("http://juiceshop-%s.%s.svc.cluster.local:3000", team, bundle.RuntimeEnvironment.Namespace)
			bundle.Log.Printf("Proxying request for team (%s): %s %s to %s", team, req.Method, req.URL, target)
			// Rewrite the request to the target server
			newReverseProxy(target).ServeHTTP(responseWriter, req)
		})
}
