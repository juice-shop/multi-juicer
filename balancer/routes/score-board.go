package routes

import (
	"encoding/json"
	"net/http"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
)

type ScoreBoardResponse struct {
	TotalTeams int                 `json:"totalTeams"`
	TopTeams   []scoring.TeamScore `json:"teams"`
}

func handleScoreBoard(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			totalTeams := scoring.GetScores()

			var topTeams []scoring.TeamScore
			// limit score-board to calculate score for the top 24 teams only
			if len(totalTeams) > 24 {
				topTeams = totalTeams[:24]
			} else {
				topTeams = totalTeams
			}

			response := ScoreBoardResponse{
				TotalTeams: len(totalTeams),
				TopTeams:   topTeams,
			}

			responseBytes, err := json.Marshal(response)
			if err != nil {
				bundle.Log.Printf("Failed to marshal response: %s", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write(responseBytes)
		},
	)
}
