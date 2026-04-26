package cleaner

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

type Summary struct {
	SuccessfulDeletions int
	FailedDeletions     int
}

func RunCleanup(ctx context.Context, log *slog.Logger, clientset kubernetes.Interface, namespace string, currentTime time.Time, maxInactive time.Duration) (Summary, error) {
	deployments, err := clientset.AppsV1().Deployments(namespace).List(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
	})
	if err != nil {
		return Summary{}, err
	}

	if len(deployments.Items) == 0 {
		log.Info("No JuiceShop deployments found. Nothing to do.")
	}

	summary := Summary{}

	for _, deployment := range deployments.Items {
		lastConnectedTimestampString, hasAnnotation := deployment.Annotations["multi-juicer.owasp-juice.shop/lastRequest"]
		if !hasAnnotation || lastConnectedTimestampString == "" {
			log.Warn("Skipping deployment as it has no lastRequest annotation", "deployment", deployment.Name)
			continue
		}
		lastConnectedTimestamp, err := strconv.ParseInt(lastConnectedTimestampString, 10, 64)
		if err != nil {
			log.Warn("Skipping deployment as it has an invalid lastRequest annotation", "deployment", deployment.Name, "error", err)
			continue
		}

		name := deployment.Name
		if currentTime.Sub(time.UnixMilli(lastConnectedTimestamp)) > maxInactive {
			log.Info("Deleting instance as it has been inactive for too long", "instance", name, "maxInactive", maxInactive.String())
			// The service and secret are owned by the deployment via OwnerReferences and will be garbage collected by Kubernetes.
			err = clientset.AppsV1().Deployments(namespace).Delete(ctx, name, metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				log.Error("Failed to delete deployment", "deployment", name, "error", err)
				summary.FailedDeletions++
				continue
			}
			summary.SuccessfulDeletions++
			log.Info("Successfully deleted instance", "instance", name)
		} else {
			log.Debug("Skipping deployment as it has been active recently", "deployment", name)
		}
	}

	return summary, nil
}
