package routes

import (
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

func handleLogout(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			http.SetCookie(responseWriter, &http.Cookie{Name: bundle.Config.CookieConfig.Name, Path: "/", MaxAge: -1})
			responseWriter.WriteHeader(http.StatusOK)
		},
	)
}
