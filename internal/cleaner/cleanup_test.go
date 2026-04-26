package cleaner

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"strconv"
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	clientgotesting "k8s.io/client-go/testing"
)

var testNamespace = "test-namespace"

func newTestLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestRunCleanup(t *testing.T) {
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

	ctx := context.Background()
	log := newTestLogger()

	t.Run("No Deployments Found", func(t *testing.T) {
		clientset := fake.NewClientset()
		currentTime := time.Now()
		maxInactive := 30 * time.Minute

		summary, err := RunCleanup(ctx, log, clientset, testNamespace, currentTime, maxInactive)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if summary.SuccessfulDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Deployment Without LastRequest Annotation", func(t *testing.T) {
		clientset := fake.NewClientset(&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:        "team1",
				Namespace:   testNamespace,
				Annotations: map[string]string{},
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
				},
			},
		})

		currentTime := time.Now()
		maxInactive := 30 * time.Minute

		summary, err := RunCleanup(ctx, log, clientset, testNamespace, currentTime, maxInactive)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if summary.SuccessfulDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Deployment With Invalid LastRequest Annotation", func(t *testing.T) {
		clientset := fake.NewClientset(createDeployment("team1", "invalid"))

		currentTime := time.Now()
		maxInactive := 30 * time.Minute

		summary, err := RunCleanup(ctx, log, clientset, testNamespace, currentTime, maxInactive)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if summary.SuccessfulDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Active Deployment - Should Not Be Deleted", func(t *testing.T) {
		lastRequestTime := strconv.FormatInt(time.Now().Add(-10*time.Minute).UnixMilli(), 10)
		clientset := fake.NewClientset(createDeployment("team1", lastRequestTime))

		currentTime := time.Now()
		maxInactive := 30 * time.Minute

		summary, err := RunCleanup(ctx, log, clientset, testNamespace, currentTime, maxInactive)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if summary.SuccessfulDeletions != 0 {
			t.Errorf("Expected no deletions, got: %v", summary)
		}
	})

	t.Run("Inactive Deployment - Should Be Deleted", func(t *testing.T) {
		lastRequestTime := strconv.FormatInt(time.Now().Add(-60*time.Minute).UnixMilli(), 10)
		clientset := fake.NewClientset(createDeployment("team1", lastRequestTime))

		currentTime := time.Now()
		maxInactive := 30 * time.Minute

		summary, err := RunCleanup(ctx, log, clientset, testNamespace, currentTime, maxInactive)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if summary.SuccessfulDeletions != 1 {
			t.Errorf("Expected 1 deletion, got: %v", summary)
		}
	})

	t.Run("Failure to Delete Deployment", func(t *testing.T) {
		clientset := fake.NewClientset(createDeployment("team1", strconv.FormatInt(time.Now().Add(-60*time.Minute).UnixMilli(), 10)))

		clientset.PrependReactor("delete", "deployments", func(action clientgotesting.Action) (handled bool, ret runtime.Object, err error) {
			return true, nil, fmt.Errorf("failed to delete deployment")
		})

		currentTime := time.Now()
		maxInactive := 30 * time.Minute

		summary, err := RunCleanup(ctx, log, clientset, testNamespace, currentTime, maxInactive)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if summary.FailedDeletions != 1 {
			t.Errorf("Expected 1 failed deletion, got: %v", summary)
		}
	})
}
