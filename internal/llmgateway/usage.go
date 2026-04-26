package llmgateway

import (
	"context"
	"fmt"
	"log/slog"
	"maps"
	"strconv"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
)

const (
	annotationInputTokens  = "multi-juicer.owasp-juice.shop/llmInputTokens"
	annotationOutputTokens = "multi-juicer.owasp-juice.shop/llmOutputTokens"
	maxRetries             = 3
)

// UsageTracker accumulates per-team LLM token usage and flushes it to deployment annotations.
type UsageTracker struct {
	mu    sync.Mutex
	usage map[string]*TeamUsage
}

// TeamUsage holds accumulated token counts for a team.
type TeamUsage struct {
	InputTokens  int64
	OutputTokens int64
}

// NewUsageTracker creates a new usage tracker.
func NewUsageTracker() *UsageTracker {
	return &UsageTracker{
		usage: make(map[string]*TeamUsage),
	}
}

// Add accumulates token usage for a team.
func (t *UsageTracker) Add(team string, inputTokens, outputTokens int64) {
	t.mu.Lock()
	defer t.mu.Unlock()
	u, ok := t.usage[team]
	if !ok {
		u = &TeamUsage{}
		t.usage[team] = u
	}
	u.InputTokens += inputTokens
	u.OutputTokens += outputTokens
}

// FlushToAnnotations writes accumulated usage to deployment annotations and resets the counters.
func (t *UsageTracker) FlushToAnnotations(ctx context.Context, clientset kubernetes.Interface, namespace string, logger *slog.Logger) {
	t.mu.Lock()
	pending := t.usage
	t.usage = make(map[string]*TeamUsage)
	t.mu.Unlock()

	for team, usage := range pending {
		if err := t.updateTeamAnnotations(ctx, clientset, namespace, team, usage, logger); err != nil {
			logger.Error("Failed to flush LLM usage", "team", team, "error", err)
			// Put the usage back so it's not lost
			t.Add(team, usage.InputTokens, usage.OutputTokens)
		}
	}
}

// updateTeamAnnotations uses optimistic concurrency (read resourceVersion, retry on conflict)
// to safely increment token counters even when multiple balancer replicas are running.
func (t *UsageTracker) updateTeamAnnotations(ctx context.Context, clientset kubernetes.Interface, namespace, team string, delta *TeamUsage, logger *slog.Logger) error {
	deploymentName := fmt.Sprintf("juiceshop-%s", team)

	for attempt := range maxRetries {
		deployment, err := clientset.AppsV1().Deployments(namespace).Get(ctx, deploymentName, metav1.GetOptions{})
		if err != nil {
			return fmt.Errorf("failed to get deployment: %w", err)
		}

		currentInput := int64(0)
		currentOutput := int64(0)
		if v, ok := deployment.Annotations[annotationInputTokens]; ok {
			currentInput, _ = strconv.ParseInt(v, 10, 64)
		}
		if v, ok := deployment.Annotations[annotationOutputTokens]; ok {
			currentOutput, _ = strconv.ParseInt(v, 10, 64)
		}

		newAnnotations := map[string]string{
			annotationInputTokens:  strconv.FormatInt(currentInput+delta.InputTokens, 10),
			annotationOutputTokens: strconv.FormatInt(currentOutput+delta.OutputTokens, 10),
		}

		// Copy existing annotations and merge new values
		updatedAnnotations := make(map[string]string, len(deployment.Annotations)+2)
		maps.Copy(updatedAnnotations, deployment.Annotations)
		maps.Copy(updatedAnnotations, newAnnotations)
		deployment.Annotations = updatedAnnotations

		_, err = clientset.AppsV1().Deployments(namespace).Update(ctx, deployment, metav1.UpdateOptions{})
		if err == nil {
			return nil
		}
		if !errors.IsConflict(err) {
			return fmt.Errorf("failed to update deployment: %w", err)
		}
		logger.Warn("LLM usage update conflict, retrying", "team", team, "attempt", attempt+1, "maxRetries", maxRetries)
	}

	return fmt.Errorf("failed to update deployment after %d retries due to conflicts", maxRetries)
}

// StartFlusher periodically flushes accumulated usage to deployment annotations.
func (t *UsageTracker) StartFlusher(ctx context.Context, clientset kubernetes.Interface, namespace string, logger *slog.Logger) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			t.FlushToAnnotations(ctx, clientset, namespace, logger)
		case <-ctx.Done():
			// Final flush on shutdown
			t.FlushToAnnotations(context.Background(), clientset, namespace, logger)
			return
		}
	}
}
