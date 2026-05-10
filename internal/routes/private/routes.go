package private

import (
	"context"
	"net/http"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/metrics"
)

func AddRoutes(ctx context.Context, mux *http.ServeMux, b *bundle.Bundle) {
	mux.Handle("POST /team/{team}/webhook", metrics.TrackRequestMetrics(metrics.RequestTypeAPIInternal, NewSolutionsWebhookHandler(b)))
	mux.Handle("/", metrics.TrackRequestMetrics(metrics.RequestTypeAPIInternal, newLLMGatewayHandler(ctx, b)))
}
