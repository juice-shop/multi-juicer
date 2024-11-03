package main

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	clientgotesting "k8s.io/client-go/testing"
)

var testNamespace = "test-namespace"

func TestRunCleanup(t *testing.T) {
	// Helper function to create a deployment with annotations
	createDeployment := func(team string, lastRequest string) *appsv1.Deployment {
		return &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: testNamespace,
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
				},
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/lastRequest": lastRequest,
				},
			},
		}
	}
	createService := func(team string) *corev1.Service {
		return &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: testNamespace,
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
				},
			},
		}
	}

	t.Run("No Deployments Found", func(t *testing.T) {
		clientset := fake.NewSimpleClientset()
		currentTime := time.Now()
		maxInactive := time.Duration(30 * time.Minute)

		summary := runCleanup(clientset, currentTime, maxInactive)

		if summary.SuccessfulDeploymentDeletions != 0 || summary.SuccessfulServiceDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Deployment Without LastRequest Annotation", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "team1",
				Namespace:   testNamespace,
				Annotations: map[string]string{},
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
				},
			},
		}, createService("team1"))

		currentTime := time.Now()
		maxInactive := time.Duration(30 * time.Minute)

		summary := runCleanup(clientset, currentTime, maxInactive)

		if summary.SuccessfulDeploymentDeletions != 0 || summary.SuccessfulServiceDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Deployment With Invalid LastRequest Annotation", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(createDeployment("team1", "invalid"), createService("team1"))

		currentTime := time.Now()
		maxInactive := time.Duration(30 * time.Minute)

		summary := runCleanup(clientset, currentTime, maxInactive)

		if summary.SuccessfulDeploymentDeletions != 0 || summary.SuccessfulServiceDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Active Deployment - Should Not Be Deleted", func(t *testing.T) {
		lastRequestTime := strconv.FormatInt(time.Now().Add(-10*time.Minute).UnixMilli(), 10)
		clientset := fake.NewSimpleClientset(createDeployment("team1", lastRequestTime), createService("team1"))

		currentTime := time.Now()
		maxInactive := time.Duration(30 * time.Minute)

		summary := runCleanup(clientset, currentTime, maxInactive)

		if summary.SuccessfulDeploymentDeletions != 0 || summary.SuccessfulServiceDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Inactive Deployment - Should Be Deleted", func(t *testing.T) {
		lastRequestTime := strconv.FormatInt(time.Now().Add(-60*time.Minute).UnixMilli(), 10)
		clientset := fake.NewSimpleClientset(
			createDeployment("team1", lastRequestTime),
			createService("team1"),
		)

		currentTime := time.Now()
		maxInactive := time.Duration(30 * time.Minute)

		summary := runCleanup(clientset, currentTime, maxInactive)

		if summary.SuccessfulDeploymentDeletions != 1 || summary.SuccessfulServiceDeletions != 1 {
			t.Errorf("Expected 1 deployment and 1 service deletion, got: %v", summary)
		}
	})

	t.Run("Failure to Delete Deployment", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(createDeployment("team1", strconv.FormatInt(time.Now().Add(-60*time.Minute).UnixMilli(), 10)), createService("team1"))

		clientset.PrependReactor("delete", "deployments", func(action clientgotesting.Action) (handled bool, ret runtime.Object, err error) {
			return true, nil, fmt.Errorf("failed to delete deployment")
		})

		currentTime := time.Now()
		maxInactive := time.Duration(30 * time.Minute)

		summary := runCleanup(clientset, currentTime, maxInactive)

		if summary.FailedDeploymentDeletions != 1 {
			t.Errorf("Expected 1 failed deployment deletion, got: %v", summary)
		}
	})

	t.Run("Failure to Delete Service", func(t *testing.T) {
		lastRequestTime := strconv.FormatInt(time.Now().Add(-60*time.Minute).UnixMilli(), 10)
		clientset := fake.NewSimpleClientset(
			createDeployment("team1", lastRequestTime),
			createService("team1"),
		)

		clientset.PrependReactor("delete", "services", func(action clientgotesting.Action) (handled bool, ret runtime.Object, err error) {
			return true, nil, fmt.Errorf("failed to delete service")
		})

		currentTime := time.Now()
		maxInactive := time.Duration(30 * time.Minute)

		summary := runCleanup(clientset, currentTime, maxInactive)

		if summary.FailedServiceDeletions != 1 {
			t.Errorf("Expected 1 failed service deletion, got: %v", summary)
		}
	})
}
