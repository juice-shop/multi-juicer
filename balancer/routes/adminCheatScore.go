package routes

import (
	"encoding/json"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

// CheatScoreResponse is the response payload for the cheat score endpoint.
type CheatScoreResponse struct {
	Team       string  `json:"team"`
	CheatScore float64 `json:"cheatScore"`
}

func handleAdminCheatScore(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 1. Authenticate as admin. This is crucial.
		team, err := teamcookie.GetTeamFromRequest(bundle, r)
		if err != nil || team != "admin" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		teamToQuery := r.PathValue("team")
		if !isValidTeamName(teamToQuery) {
			http.Error(w, "Invalid team name", http.StatusBadRequest)
			return
		}

		// 2. Placeholder Logic: Return a mock cheat score.
		// In a future implementation, this would involve querying Prometheus
		// or another data source where the cheat score is stored/calculated.
		// For now, we return a static value
		mockCheatScore := 0.15

		// 3. Construct and send the response.
		response := CheatScoreResponse{
			Team:       teamToQuery,
			CheatScore: mockCheatScore,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})
}
