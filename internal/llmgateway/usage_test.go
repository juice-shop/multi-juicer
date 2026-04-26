package llmgateway

import (
	"context"
	"log/slog"
	"os"
	"testing"

	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestUsageTracker_Add(t *testing.T) {
	tracker := NewUsageTracker()
	tracker.Add("team-a", 10, 20)
	tracker.Add("team-a", 5, 3)
	tracker.Add("team-b", 100, 200)

	tracker.mu.Lock()
	defer tracker.mu.Unlock()

	if u := tracker.usage["team-a"]; u.InputTokens != 15 || u.OutputTokens != 23 {
		t.Errorf("expected 15/23 for team-a, got %d/%d", u.InputTokens, u.OutputTokens)
	}
	if u := tracker.usage["team-b"]; u.InputTokens != 100 || u.OutputTokens != 200 {
		t.Errorf("expected 100/200 for team-b, got %d/%d", u.InputTokens, u.OutputTokens)
	}
}

func TestUsageTracker_FlushToAnnotations(t *testing.T) {
	clientset := fake.NewSimpleClientset(
		&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "juiceshop-team-a",
				Namespace: "default",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/llmInputTokens":  "100",
					"multi-juicer.owasp-juice.shop/llmOutputTokens": "50",
				},
			},
		},
	)

	tracker := NewUsageTracker()
	tracker.Add("team-a", 10, 20)

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	tracker.FlushToAnnotations(context.Background(), clientset, "default", logger)

	// Verify annotations were updated
	dep, err := clientset.AppsV1().Deployments("default").Get(context.Background(), "juiceshop-team-a", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if v := dep.Annotations["multi-juicer.owasp-juice.shop/llmInputTokens"]; v != "110" {
		t.Errorf("expected 110 input tokens, got %s", v)
	}
	if v := dep.Annotations["multi-juicer.owasp-juice.shop/llmOutputTokens"]; v != "70" {
		t.Errorf("expected 70 output tokens, got %s", v)
	}

	// Verify tracker was reset
	tracker.mu.Lock()
	if len(tracker.usage) != 0 {
		t.Error("expected usage map to be empty after flush")
	}
	tracker.mu.Unlock()
}

func TestUsageTracker_FlushRetainsOnError(t *testing.T) {
	// No deployment exists — flush should fail and retain usage
	clientset := fake.NewSimpleClientset()

	tracker := NewUsageTracker()
	tracker.Add("nonexistent", 10, 20)

	logger := slog.New(slog.NewTextHandler(os.Stdout, nil))
	tracker.FlushToAnnotations(context.Background(), clientset, "default", logger)

	// Usage should be retained
	tracker.mu.Lock()
	u, ok := tracker.usage["nonexistent"]
	tracker.mu.Unlock()
	if !ok {
		t.Fatal("expected usage to be retained after failed flush")
	}
	if u.InputTokens != 10 || u.OutputTokens != 20 {
		t.Errorf("expected 10/20, got %d/%d", u.InputTokens, u.OutputTokens)
	}
}
