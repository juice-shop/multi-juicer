package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
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

type teamNotFoundError struct{}

func (e *teamNotFoundError) Error() string {
	return "team not found"
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

			// Define the fetch function for long polling
			fetchFunc := func(ctx context.Context, waitAfter *time.Time) (*scoring.TeamScore, time.Time, bool, error) {
				if waitAfter != nil {
					teamScore := scoringService.WaitForTeamUpdatesNewerThan(ctx, team, *waitAfter)
					if teamScore == nil {
						return nil, time.Time{}, false, nil
					}
					return teamScore, time.Now(), true, nil
				}
				teamScore, ok := scoringService.GetScoreForTeam(team)
				if !ok {
					// Return error to trigger 404
					return nil, time.Time{}, false, &teamNotFoundError{}
				}
				return teamScore, time.Now(), true, nil
			}

			teamScore, _, statusCode, err := longpoll.HandleLongPoll(req, fetchFunc)
			if err != nil {
				if _, ok := err.(*teamNotFoundError); ok {
					http.Error(responseWriter, "team not found", http.StatusNotFound)
					return
				}
				bundle.Log.Printf("Long poll error: %s", err)
				http.Error(responseWriter, "Invalid time format for wait-for-update-after", statusCode)
				return
			}
			if statusCode == http.StatusNoContent {
				responseWriter.WriteHeader(http.StatusNoContent)
				return
			}

			teamCount := len(scoringService.GetScores())

			solvedChallenges := make([]SolvedChallenge, len(teamScore.Challenges))
			for i, challenge := range teamScore.Challenges {
				solvedChallenges[i] = SolvedChallenge{
					Key:        challenge.Key,
					Name:       challengesByKeys[challenge.Key].Name,
					Difficulty: challengesByKeys[challenge.Key].Difficulty,
					SolvedAt:   challenge.SolvedAt.Format(time.RFC3339),
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
