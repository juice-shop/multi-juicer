package routes

import (
	"encoding/json"
	"net/http"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
)

type ScoreBoardResponse struct {
	TotalTeams int          `json:"totalTeams"`
	TopTeams   []*TeamScore `json:"teams"`
}

type TeamScore struct {
	Name                 string `json:"name"`
	Score                int    `json:"score"`
	Position             int    `json:"position"`
	SolvedChallengeCount int    `json:"solvedChallengeCount"`
}

func handleScoreBoard(bundle *b.Bundle, scoringService *scoring.ScoringService) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			var totalTeams []*scoring.TeamScore

			if req.URL.Query().Get("wait-for-update-after") != "" {
				lastSeenUpdate, err := time.Parse(time.RFC3339, req.URL.Query().Get("wait-for-update-after"))
				if err != nil {
					http.Error(responseWriter, "Invalid time format", http.StatusBadRequest)
					return
				}
				totalTeams = scoringService.WaitForUpdatesNewerThan(req.Context(), lastSeenUpdate)
				if totalTeams == nil {
					bundle.Log.Printf("Got nothing from waiting for updates")
					responseWriter.WriteHeader(http.StatusNoContent)
					responseWriter.Write([]byte{})
					return
				}
			} else {
				totalTeams = scoringService.GetTopScores()
			}
			var topTeams []*scoring.TeamScore
			// limit score-board to calculate score for the top 24 teams only
			if len(totalTeams) > 24 {
				topTeams = totalTeams[:24]
			} else {
				topTeams = totalTeams
			}

			convertedTopScores := make([]*TeamScore, len(topTeams))
			for i, topTeam := range topTeams {
				convertedTopScores[i] = &TeamScore{
					Name:                 topTeam.Name,
					Score:                topTeam.Score,
					Position:             topTeam.Position,
					SolvedChallengeCount: len(topTeam.Challenges),
				}
			}

			response := ScoreBoardResponse{
				TotalTeams: len(totalTeams),
				TopTeams:   convertedTopScores,
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
