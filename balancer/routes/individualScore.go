package routes

import (
	"encoding/json"
	"net/http"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
)

type IndividualScore struct {
	Name             string `json:"name"`
	Score            int    `json:"score"`
	SolvedChallenges int    `json:"solvedChallenges"`
	Position         int    `json:"position"`
	TotalTeams       int    `json:"totalTeams"`
}

func handleIndividualScore(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team := req.PathValue("team")

			if !isValidTeamName(team) {
				http.Error(responseWriter, "invalid team name", http.StatusBadRequest)
				return
			}

			currentScores := scoring.GetScores()
			var teamScore scoring.TeamScore
			for _, score := range currentScores {
				if score.Name == team {
					teamScore = score
					break
				}
			}
			teamCount := len(currentScores)
			if teamScore.Name == "" {
				http.Error(responseWriter, "team not found", http.StatusNotFound)
				return
			}

			response := IndividualScore{
				Name:             team,
				Score:            teamScore.Score,
				Position:         teamScore.Position,
				TotalTeams:       teamCount,
				SolvedChallenges: len(teamScore.Challenges),
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
