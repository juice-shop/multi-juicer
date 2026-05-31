package public

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/internal/testutil"
	"github.com/stretchr/testify/assert"
)

// Test for the HelloHandler
func TestStaticFileHandler(t *testing.T) {
	t.Run("should return static files when requested", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/multi-juicer/", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = testutil.UIBuildDir()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "text/html; charset=utf-8", rr.Header().Get("Content-Type"))
		assert.Contains(t, rr.Body.String(), "<title>MultiJuicer</title>")
	})

	t.Run("should return index.html too when requesting a route handled by the frontend router", func(t *testing.T) {
		frontendRoutes := []string{
			"/multi-juicer/admin",
			"/multi-juicer/teams/abc/status/",
			"/multi-juicer/teams/foo-bar-123/status/",
			"/multi-juicer/teams/abc/joining/",
			"/multi-juicer/score-overview/",
			"/multi-juicer/score-overview/teams/abc/score/",
			"/multi-juicer/ctf",
		}

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = testutil.UIBuildDir()
		AddRoutes(server, bundle)

		for _, route := range frontendRoutes {
			req, _ := http.NewRequest("GET", route, nil)
			rr := httptest.NewRecorder()
			server.ServeHTTP(rr, req)

			assert.Equal(t, http.StatusOK, rr.Code)
			assert.Equal(t, "text/html; charset=utf-8", rr.Header().Get("Content-Type"))
			assert.Contains(t, rr.Body.String(), "<title>MultiJuicer</title>")
		}
	})

	t.Run("should set Content-Security-Policy header for index.html when CSP is configured", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/multi-juicer/admin", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = testutil.UIBuildDir()
		bundle.Config.ContentSecurityPolicy = "default-src 'self'; script-src 'self'"
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "default-src 'self'; script-src 'self'", rr.Header().Get("Content-Security-Policy"))
	})

	t.Run("should not set Content-Security-Policy header when CSP is empty", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/multi-juicer/admin", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = testutil.UIBuildDir()
		bundle.Config.ContentSecurityPolicy = ""
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Empty(t, rr.Header().Get("Content-Security-Policy"))
	})

	t.Run("should not set Content-Security-Policy header for non-index.html static files", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/multi-juicer/favicon.ico", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = testutil.UIBuildDir()
		bundle.Config.ContentSecurityPolicy = "default-src 'self'; script-src 'self'"
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Empty(t, rr.Header().Get("Content-Security-Policy"))
	})

	t.Run("should redirect the balancer logo when a custom logo URL is configured", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/multi-juicer/multi-juicer.svg", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = testutil.UIBuildDir()
		bundle.Config.ThemeConfig.LogoURL = "/multi-juicer/custom/logo.png"
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusFound, rr.Code)
		assert.Equal(t, "/multi-juicer/custom/logo.png", rr.Header().Get("Location"))
	})

	t.Run("should redirect the favicon when a custom favicon URL is configured", func(t *testing.T) {
		for _, path := range []string{"/multi-juicer/favicon.ico", "/multi-juicer/favicon.svg"} {
			req, _ := http.NewRequest("GET", path, nil)
			rr := httptest.NewRecorder()

			server := http.NewServeMux()
			bundle := testutil.NewTestBundle()
			bundle.StaticAssetsDirectory = testutil.UIBuildDir()
			bundle.Config.ThemeConfig.FaviconURL = "/multi-juicer/custom/favicon.png"
			AddRoutes(server, bundle)

			server.ServeHTTP(rr, req)

			assert.Equal(t, http.StatusFound, rr.Code)
			assert.Equal(t, "/multi-juicer/custom/favicon.png", rr.Header().Get("Location"))
		}
	})
}
