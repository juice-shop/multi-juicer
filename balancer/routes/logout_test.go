package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
)

func TestLogoutHandler(t *testing.T) {
	t.Run("logout unsets the balancer cookie", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/teams/logout", nil)
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)
		server.ServeHTTP(rr, req)

		assert.Equal(t, rr.Code, http.StatusOK)
		assert.Equal(t, fmt.Sprintf("%s=; Path=/; Max-Age=0", bundle.Config.CookieConfig.Name), rr.Header().Get("Set-Cookie"))
	})
}
