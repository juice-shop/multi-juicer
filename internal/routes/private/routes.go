package private

import (
	"context"
	"net/http"

	"github.com/juice-shop/multi-juicer/internal/bundle"
)

func AddRoutes(ctx context.Context, mux *http.ServeMux, b *bundle.Bundle) {
	mux.Handle("POST /team/{team}/webhook", NewSolutionsWebhookHandler(b))
	mux.Handle("/", newLLMGatewayHandler(ctx, b))
}
