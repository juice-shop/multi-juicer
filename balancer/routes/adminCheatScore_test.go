package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
)

func TestAdminCheatScoreHandler(t *testing.T) {
	bundle := testutil.NewTestBundle()
	server := http.NewServeMux()
	AddRoutes(server, bundle, nil)

	targetTeam := "test-team"

	t.Run("should return a mock cheat score for a valid team when logged in as admin", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/admin/teams/%s/cheat-score", targetTeam), nil)
		// Set the admin cookie
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))

		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"team":"test-team", "cheatScore": 0.15}`, rr.Body.String())
	})

	t.Run("should return 401 Unauthorized if not logged in as admin", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/admin/teams/%s/cheat-score", targetTeam), nil)
		// Set a non-admin cookie
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("not-an-admin")))

		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 401 Unauthorized if no cookie is present", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/admin/teams/%s/cheat-score", targetTeam), nil)

		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("should return 400 Bad Request for an invalid team name", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/teams/inv@lid-team/cheat-score", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))

		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}
