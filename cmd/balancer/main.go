package main

import (
	"context"
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/juice-shop/multi-juicer/internal/balancer/routes"
	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/cleaner"
	"github.com/juice-shop/multi-juicer/internal/leader"
	"github.com/juice-shop/multi-juicer/internal/llmgateway"
	"github.com/juice-shop/multi-juicer/internal/notification"
	"github.com/juice-shop/multi-juicer/internal/progresswatchdog"
	"github.com/juice-shop/multi-juicer/internal/scoring"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"k8s.io/klog/v2"
)

const (
	progressWatchdogWorkers = 10
	cleanupInterval         = 1 * time.Minute
	leaderReacquireBackoff  = 5 * time.Second
)

func main() {
	b := bundle.New()

	// Route client-go's klog output (used by the leaderelection package) through our slog logger so
	// every line shares the same format.
	klog.SetSlogLogger(b.Log)

	scoringService := scoring.NewScoringService(b)
	notificationService := notification.NewNotificationService(b)

	b.ScoringService = scoringService
	b.NotificationService = notificationService

	ctx := context.Background()

	go StartMetricsServer()
	scoringService.CalculateAndCacheScoreBoard(ctx)
	go scoringService.StartingScoringWorker(ctx)
	go notificationService.StartNotificationWatcher(ctx)

	internalMux := http.NewServeMux()
	internalMux.Handle("POST /team/{team}/webhook", routes.NewSolutionsWebhookHandler(b))

	if b.Config.JuiceShopConfig.LLM.Enabled {
		llmAPIKey := os.Getenv("LLM_API_KEY")
		llmAPIURL := os.Getenv("LLM_API_URL")

		usage := llmgateway.NewUsageTracker()
		gateway, err := llmgateway.NewGateway(b.Config.CookieConfig.SigningKey, llmAPIURL, llmAPIKey, usage, b.Log)
		if err != nil {
			log.Fatalf("Failed to create LLM gateway: %v", err)
		}
		go usage.StartFlusher(ctx, b.ClientSet, b.RuntimeEnvironment.Namespace, b.Log)
		// Catch-all — must be registered last so the more specific webhook route wins.
		internalMux.Handle("/", gateway)
		b.Log.Info("LLM gateway mounted on internal port :8082")
	}

	go StartInternalServer(internalMux, b.Log)

	go runLeaderLoop(ctx, b)

	StartBalancerServer(b)
}

func runLeaderLoop(ctx context.Context, b *bundle.Bundle) {
	identity := os.Getenv("POD_NAME")
	if identity == "" {
		// Fall back to hostname-ish so leader election still works in non-k8s test setups; in-cluster the
		// downward API populates POD_NAME and this branch is dead.
		host, err := os.Hostname()
		if err != nil || host == "" {
			panic(errors.New("POD_NAME is not set and hostname could not be determined"))
		}
		identity = host
	}

	onStartedLeading := func(leaderCtx context.Context) {
		go progresswatchdog.StartBackgroundSync(leaderCtx, b.Log, b.ClientSet, b.RuntimeEnvironment.Namespace, progressWatchdogWorkers)

		maxInactive, err := time.ParseDuration(os.Getenv("MAX_INACTIVE_DURATION"))
		if err != nil {
			b.Log.Error("Could not parse MAX_INACTIVE_DURATION; cleanup loop will not run", "value", os.Getenv("MAX_INACTIVE_DURATION"), "error", err)
			return
		}
		go cleaner.StartPeriodicCleanup(leaderCtx, b.Log, b.ClientSet, b.RuntimeEnvironment.Namespace, cleanupInterval, maxInactive)
	}

	// leader.Run returns when leadership is lost; re-enter the election so a transient renewal failure
	// doesn't permanently disable the singleton background work on this replica.
	for {
		leader.Run(ctx, b.Log, b.ClientSet, b.RuntimeEnvironment.Namespace, identity, onStartedLeading)
		if ctx.Err() != nil {
			return
		}
		b.Log.Warn("Re-entering leader election after losing or releasing the lease", "backoff", leaderReacquireBackoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(leaderReacquireBackoff):
		}
	}
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

func StartInternalServer(handler http.Handler, logger *slog.Logger) {
	server := &http.Server{
		Addr:    ":8082",
		Handler: handler,
	}
	logger.Info("Starting internal server on :8082")
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Failed to start internal server: %v", err)
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
