package main

import (
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/routes/proxy"
	"github.com/juice-shop/multi-juicer/balancer/routes/teams"
)

func addRoutes(
	router *http.ServeMux,
	bundle *bundle.Bundle,
) {
	router.Handle("POST /balancer/teams/{team}/join", teams.HandleTeamJoin(bundle))
	router.Handle("GET /balancer/teams/{team}/wait-till-ready", teams.HandleWaitTillReady(bundle))

	router.HandleFunc("GET /balancer/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	router.HandleFunc("GET /balancer/readiness", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	router.Handle("/", proxy.HandleProxy(bundle))
}
