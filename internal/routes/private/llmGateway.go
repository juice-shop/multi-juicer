package private

import (
	"context"
	"log"
	"net/http"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/llmgateway"
)

// newLLMGatewayHandler returns the LLM gateway when enabled, or a 501 stub
// when the deployment hasn't opted into the feature. 501 ("Not Implemented")
// matches "the feature is not configured in this deployment" better than 503
// would, which is reserved for transient unavailability.
func newLLMGatewayHandler(ctx context.Context, b *bundle.Bundle) http.Handler {
	if !b.Config.JuiceShopConfig.LLM.Enabled {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.Error(w, "LLM gateway is not enabled in this deployment", http.StatusNotImplemented)
		})
	}

	usage := llmgateway.NewUsageTracker()
	gateway, err := llmgateway.NewGateway(b, usage)
	if err != nil {
		log.Fatalf("Failed to create LLM gateway: %v", err)
	}
	go usage.StartFlusher(ctx, b)
	b.Log.Info("LLM gateway mounted on internal port :8082")
	return gateway
}
