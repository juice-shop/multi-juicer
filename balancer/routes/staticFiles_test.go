package routes

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
)

// Test for the HelloHandler
func TestStaticFileHandler(t *testing.T) {
	t.Run("should return static files when requested", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = "../ui/build/"
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "text/html; charset=utf-8", rr.Header().Get("Content-Type"))
		assert.Contains(t, rr.Body.String(), "<title>MultiJuicer</title>")
	})

	t.Run("should return index.html too when requesting a route handled by the frontend router", func(t *testing.T) {
		frontendRoutes := []string{
			"/balancer/admin",
			"/balancer/teams/abc/status/",
			"/balancer/teams/foo-bar-123/status/",
			"/balancer/teams/abc/joined/",
			"/balancer/score-board/",
			"/balancer/score-board/teams/abc/score/",
		}

		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		bundle.StaticAssetsDirectory = "../ui/build/"
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
}
