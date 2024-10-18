package routes

import (
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

func AddRoutes(
	router *http.ServeMux,
	bundle *bundle.Bundle,
) {
	router.Handle("GET /balancer/", handleStaticFiles(bundle))
	router.Handle("POST /balancer/teams/{team}/join", handleTeamJoin(bundle))
	router.Handle("GET /balancer/teams/{team}/wait-till-ready", handleWaitTillReady(bundle))

	router.HandleFunc("GET /balancer/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	router.HandleFunc("GET /balancer/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	router.Handle("/", handleProxy(bundle))
}
