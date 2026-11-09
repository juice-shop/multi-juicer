package public

import (
	"encoding/json"
	"net/http"

	b "github.com/juice-shop/multi-juicer/internal/bundle"
)

// UIConfigResponse tells the balancer UI which of the optional views to link.
type UIConfigResponse struct {
	ShowScoreboardView bool `json:"showScoreboardView"`
	ShowCtfView        bool `json:"showCtfView"`
}

func handleUIConfig(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(UIConfigResponse{
			ShowScoreboardView: bundle.Config.ShowScoreboardView,
			ShowCtfView:        bundle.Config.ShowCtfView,
		})
	})
}
