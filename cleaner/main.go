package main

import (
	"context"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var logger = slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: parseLogLevel(os.Getenv("LOG_LEVEL"))}))
var namespace = os.Getenv("NAMESPACE")

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

	currentTime := time.Now()

	cleanupSummary := runCleanup(clientset, currentTime, maxInactiveTime)

	logger.Info("Finished cleaning up JuiceShop deployments.")
	logger.Info("Deleted deployment(s) successfully", "count", cleanupSummary.SuccessfulDeletions)
	if cleanupSummary.FailedDeletions > 0 {
		logger.Warn("Failed to delete some deployments", "count", cleanupSummary.FailedDeletions)
	}
}

type CleanupSummary struct {
	SuccessfulDeletions int
	FailedDeletions     int
}

func runCleanup(clientset kubernetes.Interface, currentTime time.Time, maxInactive time.Duration) CleanupSummary {
	deployments, err := clientset.AppsV1().Deployments(namespace).List(context.Background(), metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
	})

	if err != nil {
		logger.Error("failed to list deployments to find JuiceShop instances to cleanup", "error", err)
		os.Exit(1)
	}

	if len(deployments.Items) == 0 {
		logger.Info("No JuiceShop deployments found. Nothing to do.")
	}

	summary := CleanupSummary{}

	for _, deployment := range deployments.Items {
		lastConnectedTimestampString, hasAnnotation := deployment.Annotations["multi-juicer.owasp-juice.shop/lastRequest"]
		if !hasAnnotation || lastConnectedTimestampString == "" {
			logger.Warn("Skipping deployment as it has no lastRequest annotation", "deployment", deployment.Name)
			continue
		}
		lastConnectedTimestamp, err := strconv.ParseInt(lastConnectedTimestampString, 10, 64)
		if err != nil {
			logger.Warn("Skipping deployment as it has an invalid lastRequest annotation", "deployment", deployment.Name, "error", err)
			continue
		}

		name := deployment.Name
		if currentTime.Sub(time.UnixMilli(lastConnectedTimestamp)) > maxInactive {
			logger.Info("Deleting instance as it has been inactive for too long", "instance", name, "maxInactive", maxInactive.String())
			// Only the deployment needs to be deleted explicitly.
			// The service and secret are owned by the deployment via OwnerReferences and will be garbage collected by Kubernetes.
			err = clientset.AppsV1().Deployments(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				logger.Error("Failed to delete deployment", "deployment", name, "error", err)
				summary.FailedDeletions++
				continue
			}
			summary.SuccessfulDeletions++
			logger.Info("Successfully deleted instance", "instance", name)
		} else {
			logger.Debug("Skipping deployment as it has been active recently", "deployment", name)
		}
	}

	return summary
}
