package public

import (
	"net/http"
	"regexp"

	"github.com/juice-shop/multi-juicer/internal/bundle"
)

func handleStaticFiles(bundle *bundle.Bundle) http.Handler {
	// these routes should serve the index.html file and let the frontend handle the routing
	frontendRoutePatterns := []*regexp.Regexp{
		regexp.MustCompile("/multi-juicer/admin"),
		regexp.MustCompile("/multi-juicer/teams/" + teamNamePatternString + "/status"),
		regexp.MustCompile("/multi-juicer/teams/" + teamNamePatternString + "/joining"),
		regexp.MustCompile("/multi-juicer/score-overview"),
		regexp.MustCompile("/multi-juicer/score-overview/teams/" + teamNamePatternString),
		regexp.MustCompile("/multi-juicer/score-overview/challenges/" + teamNamePatternString),
		regexp.MustCompile("/multi-juicer/ctf"),
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		for _, route := range frontendRoutePatterns {
			if route.MatchString(r.URL.Path) {
				// Set Content Security Policy header for index.html if configured
				if bundle.Config.ContentSecurityPolicy != "" {
					w.Header().Set("Content-Security-Policy", bundle.Config.ContentSecurityPolicy)
				}
				http.ServeFile(w, r, bundle.StaticAssetsDirectory+"/index.html")
				return
			}
		}

		http.StripPrefix("/multi-juicer", http.FileServer(http.Dir(bundle.StaticAssetsDirectory))).ServeHTTP(w, r)
	})
}
