package routes

import (
	"encoding/json"
	"net/http"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
)

type SolvedChallenge struct {
	Key        string `json:"key"`
	Name       string `json:"name"`
	Difficulty int    `json:"difficulty"`
	SolvedAt   string `json:"solvedAt"`
}

type IndividualScore struct {
	Name             string            `json:"name"`
	Score            int               `json:"score"`
	SolvedChallenges []SolvedChallenge `json:"solvedChallenges"`
	Position         int               `json:"position"`
	TotalTeams       int               `json:"totalTeams"`
}

func handleIndividualScore(bundle *b.Bundle, scoringService *scoring.ScoringService) http.Handler {

	challengesByKeys := make(map[string]b.JuiceShopChallenge)
	for _, challenge := range bundle.JuiceShopChallenges {
		challengesByKeys[challenge.Key] = challenge
	}

	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team := req.PathValue("team")

			if !isValidTeamName(team) {
				http.Error(responseWriter, "invalid team name", http.StatusBadRequest)
				return
			}

			currentScores := scoringService.GetScores()
			teamScore, ok := currentScores[team]
			if !ok {
				http.Error(responseWriter, "team not found", http.StatusNotFound)
				return
			}
			teamCount := len(currentScores)

			solvedChallenges := make([]SolvedChallenge, len(teamScore.Challenges))
			for i, challenge := range teamScore.Challenges {
				solvedChallenges[i] = SolvedChallenge{
					Key:        challenge.Key,
					Name:       challengesByKeys[challenge.Key].Name,
					Difficulty: challengesByKeys[challenge.Key].Difficulty,
					SolvedAt:   challenge.SolvedAt,
				}
			}

			response := IndividualScore{
				Name:             team,
				Score:            teamScore.Score,
				Position:         teamScore.Position,
				TotalTeams:       teamCount,
				SolvedChallenges: solvedChallenges,
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
