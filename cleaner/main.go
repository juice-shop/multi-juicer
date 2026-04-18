package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

var logger = log.New(os.Stdout, "", log.LstdFlags)
var namespace = os.Getenv("NAMESPACE")

func main() {
	logger.Println("Starting cleaner")

	maxInactiveTimeString := os.Getenv("MAX_INACTIVE_DURATION")
	maxInactiveTime, err := time.ParseDuration(maxInactiveTimeString)
	if err != nil {
		logger.Fatalf("Could not parse configured MAX_INACTIVE_DURATION: '%s'. Duration has to formatted like the following examples: \"12h\" for 12 hours, \"30m\" for 30 minutes.", maxInactiveTimeString)
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

	logger.Println("Finished cleaning up JuiceShop deployments.")
	logger.Printf("Deleted %d deployment(s) successfully", cleanupSummary.SuccessfulDeletions)
	if cleanupSummary.FailedDeletions > 0 {
		logger.Printf("Failed to delete %d deployment(s)", cleanupSummary.FailedDeletions)
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
		logger.Fatal(fmt.Errorf("failed to list deployments to find JuiceShop instances to cleanup: %w", err))
	}

	if len(deployments.Items) == 0 {
		logger.Println("No JuiceShop deployments found. Nothing to do.")
	}

	summary := CleanupSummary{}

	for _, deployment := range deployments.Items {
		lastConnectedTimestampString, hasAnnotation := deployment.Annotations["multi-juicer.owasp-juice.shop/lastRequest"]
		if !hasAnnotation || lastConnectedTimestampString == "" {
			logger.Printf("Skipping deployment %s as it has no lastRequest annotation", deployment.Name)
			continue
		}
		lastConnectedTimestamp, err := strconv.ParseInt(lastConnectedTimestampString, 10, 64)
		if err != nil {
			logger.Printf("Skipping deployment %s as it has an invalid lastRequest annotation: %v", deployment.Name, err)
			continue
		}

		name := deployment.Name
		if currentTime.Sub(time.UnixMilli(lastConnectedTimestamp)) > maxInactive {
			logger.Printf("Deleting instance '%s' as it has been inactive for longer than %s", name, maxInactive.String())
			// Only the deployment needs to be deleted explicitly.
			// The service and secret are owned by the deployment via OwnerReferences and will be garbage collected by Kubernetes.
			err = clientset.AppsV1().Deployments(namespace).Delete(context.Background(), name, metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				logger.Printf("Failed to delete deployment %s: %v", name, err)
				summary.FailedDeletions++
				continue
			}
			summary.SuccessfulDeletions++
			logger.Printf("Successfully deleted instance %s", name)
		} else {
			logger.Printf("Skipping deployment %s as it has been active recently", name)
		}
	}

	return summary
}
