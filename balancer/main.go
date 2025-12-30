package main

import (
	"context"
	"log"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/adminmessage"
	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/routes"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	bundle := bundle.New()
	scoringService := scoring.NewScoringService(bundle)
	adminMsgService := adminmessage.NewService()

	ctx := context.Background()

	go StartMetricsServer()
	scoringService.CalculateAndCacheScoreBoard(ctx)
	go scoringService.StartingScoringWorker(ctx)
	StartBalancerServer(bundle, scoringService, adminMsgService)
	go adminmessage.StartWatcher(ctx, bundle, adminMsgService)
}

func StartBalancerServer(bundle *bundle.Bundle, scoringService *scoring.ScoringService, adminMsgService *adminmessage.Service) {
	router := http.NewServeMux()
	routes.AddRoutes(router, bundle, scoringService, adminMsgService)

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
