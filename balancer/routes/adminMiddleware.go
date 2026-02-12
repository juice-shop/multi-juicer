package routes

import (
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

func requireAdmin(bundle *bundle.Bundle, next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, req *http.Request) {
		team, err := teamcookie.GetTeamFromRequest(bundle, req)
		if err != nil || team != "admin" {
			http.Error(responseWriter, "", http.StatusUnauthorized)
			return
		}
		next.ServeHTTP(responseWriter, req)
	})
}
