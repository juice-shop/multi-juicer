package main

import (
	"context"
	"log"
	"log/slog"
	"net/http"
	"os"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/llmgateway"
	"github.com/juice-shop/multi-juicer/balancer/pkg/notification"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/routes"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

func main() {
	b := bundle.New()

	// Initialize services
	scoringService := scoring.NewScoringService(b)
	notificationService := notification.NewNotificationService(b)

	// Wire services into bundle
	b.ScoringService = scoringService
	b.NotificationService = notificationService

	ctx := context.Background()

	go StartMetricsServer()
	scoringService.CalculateAndCacheScoreBoard(ctx)
	go scoringService.StartingScoringWorker(ctx)
	go notificationService.StartNotificationWatcher(ctx)

	if b.Config.JuiceShopConfig.LLM.Enabled {
		llmAPIKey := os.Getenv("LLM_API_KEY")
		llmAPIURL := os.Getenv("LLM_API_URL")

		usage := llmgateway.NewUsageTracker()
		gateway, err := llmgateway.NewGateway(b.Config.CookieConfig.SigningKey, llmAPIURL, llmAPIKey, usage, b.Log)
		if err != nil {
			log.Fatalf("Failed to create LLM gateway: %v", err)
		}
		go usage.StartFlusher(ctx, b.ClientSet, b.RuntimeEnvironment.Namespace, b.Log)
		go StartLLMGatewayServer(gateway, b.Log)
	}

	StartBalancerServer(b)
}

func StartBalancerServer(b *bundle.Bundle) {
	router := http.NewServeMux()
	routes.AddRoutes(router, b)

	b.Log.Info("Starting MultiJuicer balancer on :8080")
	server := &http.Server{
		Addr:    ":8080",
		Handler: router,
	}

	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start balancer server: %v", err)
	}
}

func StartLLMGatewayServer(gateway *llmgateway.Gateway, logger *slog.Logger) {
	router := http.NewServeMux()
	router.Handle("/", gateway)
	server := &http.Server{
		Addr:    ":8082",
		Handler: router,
	}
	logger.Info("Starting LLM gateway on :8082")
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start LLM gateway server: %v", err)
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
