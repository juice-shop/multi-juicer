package public

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"regexp"
	"sync"

	"github.com/juice-shop/multi-juicer/internal/bundle"
)

// uiConfigPlaceholder is the empty config block in the index.html of the ui, which gets replaced with the actual config when index.html is served.
// Embedding the config into the page lets the ui render with the right config right away, without having to fetch it first.
var uiConfigPlaceholder = []byte(`<script id="multi-juicer-ui-config" type="application/json">{}</script>`)

// UIConfig is the subset of the config exposed to the ui. Never put secrets in here, it is publicly readable.
type UIConfig struct {
	Views bundle.ViewsConfig `json:"views"`
}

// renderIndexHTML returns the index.html of the ui with the ui config embedded into it
func renderIndexHTML(b *bundle.Bundle) ([]byte, error) {
	indexHTML, err := os.ReadFile(b.StaticAssetsDirectory + "/index.html")
	if err != nil {
		return nil, fmt.Errorf("failed to read index.html: %w", err)
	}
	if !bytes.Contains(indexHTML, uiConfigPlaceholder) {
		return nil, errors.New("index.html does not contain the ui config placeholder")
	}
	// json.Marshal escapes <, > and &, so the config can't break out of the script tag
	uiConfig, err := json.Marshal(UIConfig{Views: b.Config.Views})
	if err != nil {
		return nil, fmt.Errorf("failed to marshal ui config: %w", err)
	}
	configBlock := fmt.Appendf(nil, `<script id="multi-juicer-ui-config" type="application/json">%s</script>`, uiConfig)
	return bytes.Replace(indexHTML, uiConfigPlaceholder, configBlock, 1), nil
}

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
		regexp.MustCompile("/multi-juicer/class-progress"),
	}

	// index.html and the config don't change at runtime, so it only has to be rendered once
	getIndexHTML := sync.OnceValues(func() ([]byte, error) {
		return renderIndexHTML(bundle)
	})

	serveIndexHTML := func(w http.ResponseWriter) {
		indexHTML, err := getIndexHTML()
		if err != nil {
			bundle.Log.Error("failed to render index.html", "error", err)
			http.Error(w, "failed to render index.html", http.StatusInternalServerError)
			return
		}
		// Set Content Security Policy header for index.html if configured
		if bundle.Config.ContentSecurityPolicy != "" {
			w.Header().Set("Content-Security-Policy", bundle.Config.ContentSecurityPolicy)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		// index.html is a static build asset and the only injected data is the json-encoded ui config (see renderIndexHTML), so there is no untrusted input here
		w.Write(indexHTML) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter.no-direct-write-to-responsewriter
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/multi-juicer/multi-juicer.svg" && bundle.Config.ThemeConfig.LogoURL != "" {
			http.Redirect(w, r, bundle.Config.ThemeConfig.LogoURL, http.StatusFound)
			return
		}

		if (r.URL.Path == "/multi-juicer/favicon.ico" || r.URL.Path == "/multi-juicer/favicon.svg") && bundle.Config.ThemeConfig.FaviconURL != "" {
			http.Redirect(w, r, bundle.Config.ThemeConfig.FaviconURL, http.StatusFound)
			return
		}

		if r.URL.Path == "/multi-juicer" || r.URL.Path == "/multi-juicer/" || r.URL.Path == "/multi-juicer/index.html" {
			serveIndexHTML(w)
			return
		}

		for _, route := range frontendRoutePatterns {
			if route.MatchString(r.URL.Path) {
				serveIndexHTML(w)
				return
			}
		}

		http.StripPrefix("/multi-juicer", http.FileServer(http.Dir(bundle.StaticAssetsDirectory))).ServeHTTP(w, r)
	})
}
