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
		regexp.MustCompile("/balancer/teams/" + teamNamePatternString + "/status"),
		regexp.MustCompile("/balancer/teams/" + teamNamePatternString + "/joined"),
		regexp.MustCompile("/balancer/score-board"),
		regexp.MustCompile("/balancer/score-board/teams/" + teamNamePatternString + "/score"),
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
