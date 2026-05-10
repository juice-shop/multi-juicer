package cleaner

import (
	"context"
	"strconv"
	"time"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const cleanupInterval = 1 * time.Minute

type Summary struct {
	SuccessfulDeletions int
	FailedDeletions     int
}

// StartPeriodicCleanup runs RunCleanup on a fixed interval until ctx is cancelled.
// Must run on at most one multi-juicer replica at a time (gated via leader election).
// When b.Config.Cleanup.MaxInactive is zero the cleanup loop is disabled.
func StartPeriodicCleanup(ctx context.Context, b *bundle.Bundle) {
	maxInactive := b.Config.Cleanup.MaxInactive
	if maxInactive == 0 {
		b.Log.Info("MAX_INACTIVE_DURATION not set; cleanup loop will not run")
		return
	}

	b.Log.Info("Starting periodic cleanup of inactive JuiceShop deployments", "interval", cleanupInterval, "maxInactive", maxInactive)

	ticker := time.NewTicker(cleanupInterval)
	defer ticker.Stop()

	for {
		summary, err := RunCleanup(ctx, b, time.Now())
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			b.Log.Error("Failed to list deployments during cleanup", "error", err)
		} else if summary.SuccessfulDeletions > 0 || summary.FailedDeletions > 0 {
			b.Log.Info("Cleanup pass finished", "deleted", summary.SuccessfulDeletions, "failed", summary.FailedDeletions)
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func RunCleanup(ctx context.Context, b *bundle.Bundle, currentTime time.Time) (Summary, error) {
	maxInactive := b.Config.Cleanup.MaxInactive
	deployments, err := b.ClientSet.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
	})
	if err != nil {
		return Summary{}, err
	}

	if len(deployments.Items) == 0 {
		b.Log.Info("No JuiceShop deployments found. Nothing to do.")
	}

	summary := Summary{}

	for _, deployment := range deployments.Items {
		lastConnectedTimestampString, hasAnnotation := deployment.Annotations["multi-juicer.owasp-juice.shop/lastRequest"]
		if !hasAnnotation || lastConnectedTimestampString == "" {
			b.Log.Warn("Skipping deployment as it has no lastRequest annotation", "deployment", deployment.Name)
			continue
		}
		lastConnectedTimestamp, err := strconv.ParseInt(lastConnectedTimestampString, 10, 64)
		if err != nil {
			b.Log.Warn("Skipping deployment as it has an invalid lastRequest annotation", "deployment", deployment.Name, "error", err)
			continue
		}

		name := deployment.Name
		if currentTime.Sub(time.UnixMilli(lastConnectedTimestamp)) > maxInactive {
			b.Log.Info("Deleting instance as it has been inactive for too long", "instance", name, "maxInactive", maxInactive.String())
			// The service and secret are owned by the deployment via OwnerReferences and will be garbage collected by Kubernetes.
			err = b.ClientSet.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).Delete(ctx, name, metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				b.Log.Error("Failed to delete deployment", "deployment", name, "error", err)
				summary.FailedDeletions++
				continue
			}
			summary.SuccessfulDeletions++
			b.Log.Info("Successfully deleted instance", "instance", name)
		} else {
			b.Log.Debug("Skipping deployment as it has been active recently", "deployment", name)
		}
	}

	return summary, nil
}
