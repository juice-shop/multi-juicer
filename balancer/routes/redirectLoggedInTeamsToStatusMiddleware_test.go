package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
)

func TestRedirectLoggedInTeamsToStatus(t *testing.T) {
	teamFoo := "foo"

	t.Run("passes requests without signed team to the normal handler", func(t *testing.T) {
		bundle := testutil.NewTestBundle()

		handler := redirectLoggedInTeamsToStatus(bundle, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTeapot)
			w.Write([]byte("normal handler"))
		}))

		req, _ := http.NewRequest("GET", "/balancer", nil)
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusTeapot, rr.Code)
		assert.Equal(t, "normal handler", rr.Body.String())
	})

	t.Run("redirects requests with a valid signed team cookie to the team status endpoint", func(t *testing.T) {
		bundle := testutil.NewTestBundle()

		handler := redirectLoggedInTeamsToStatus(bundle, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusTeapot)
			w.Write([]byte("normal handler"))
		}))

		req, _ := http.NewRequest("GET", "/balancer", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(teamFoo)))
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusFound, rr.Code)
		assert.Equal(t, "/balancer/teams/foo/status", rr.Header().Get("Location"))
	})
}
