package main

import (
	"context"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/juice-shop/multi-juicer/internal/cleaner"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

func parseLogLevel(level string) slog.Level {
	switch strings.ToLower(level) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: parseLogLevel(os.Getenv("LOG_LEVEL"))}))
	namespace := os.Getenv("NAMESPACE")

	logger.Info("Starting cleaner")

	maxInactiveTimeString := os.Getenv("MAX_INACTIVE_DURATION")
	maxInactiveTime, err := time.ParseDuration(maxInactiveTimeString)
	if err != nil {
		logger.Error("Could not parse configured MAX_INACTIVE_DURATION. Duration has to be formatted like: \"12h\" for 12 hours, \"30m\" for 30 minutes.", "value", maxInactiveTimeString)
		os.Exit(1)
	}

	config, err := rest.InClusterConfig()
	if err != nil {
		panic(err.Error())
	}
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	summary, err := cleaner.RunCleanup(context.Background(), logger, clientset, namespace, time.Now(), maxInactiveTime)
	if err != nil {
		logger.Error("failed to list deployments to find JuiceShop instances to cleanup", "error", err)
		os.Exit(1)
	}

	logger.Info("Finished cleaning up JuiceShop deployments.")
	logger.Info("Deleted deployment(s) successfully", "count", summary.SuccessfulDeletions)
	if summary.FailedDeletions > 0 {
		logger.Warn("Failed to delete some deployments", "count", summary.FailedDeletions)
	}
}
