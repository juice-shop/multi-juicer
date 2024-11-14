package routes

import (
	"net/http"
	"regexp"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

func handleStaticFiles(bundle *bundle.Bundle) http.Handler {
	// these routes should serve the index.html file and let the frontend handle the routing
	frontendRoutePatterns := []*regexp.Regexp{
		regexp.MustCompile("/balancer/admin"),
		regexp.MustCompile("/balancer/teams/[a-z]*/joining"),
		regexp.MustCompile("/balancer/teams/[a-z]*/status"),
		regexp.MustCompile("/balancer/score-board"),
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, route := range frontendRoutePatterns {
			if route.MatchString(r.URL.Path) {
				http.ServeFile(w, r, bundle.StaticAssetsDirectory+"/index.html")
				return
			}
		}

		http.StripPrefix("/balancer", http.FileServer(http.Dir(bundle.StaticAssetsDirectory))).ServeHTTP(w, r)
	})
}
