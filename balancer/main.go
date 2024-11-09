package main

import (
	"log"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/routes"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	bundle := bundle.New()

	go StartMetricsServer()
	go scoring.StartingScoringWorker(bundle)
	StartBalancerServer(bundle)
}

func StartBalancerServer(bundle *bundle.Bundle) {
	router := http.NewServeMux()
	routes.AddRoutes(router, bundle)

	bundle.Log.Println("Starting MultiJuicer balancer on :8080")
	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start balancer server: %v", err)
	}
}

func StartMetricsServer() {
	metricsRouter := http.NewServeMux()
	metricsRouter.Handle("GET /balancer/metrics", promhttp.Handler())
	metricServer := &http.Server{
		Addr:    ":8081",
		Handler: metricsRouter,
	}

	if err := metricServer.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start balancer server: %v", err)
	}
}
