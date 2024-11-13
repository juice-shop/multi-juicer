package routes

import (
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

func redirectLoggedInTeamsToStatus(bundle *bundle.Bundle, next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, req *http.Request) {
		team, _ := teamcookie.GetTeamFromRequest(bundle, req)
		if team != "" {
			http.Redirect(responseWriter, req, fmt.Sprintf("/balancer/teams/%s/status", team), http.StatusFound)
		}
		next.ServeHTTP(responseWriter, req)
	})
}
