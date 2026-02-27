package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

type SolvedChallenge struct {
	Key        string `json:"key"`
	Name       string `json:"name"`
	Difficulty int    `json:"difficulty"`
	SolvedAt   string `json:"solvedAt"`
}

type TeamStatus struct {
	Name             string            `json:"name"`
	Score            int               `json:"score"`
	SolvedChallenges []SolvedChallenge `json:"solvedChallenges"`
	Position         int               `json:"position"`
	TotalTeams       int               `json:"totalTeams"`
	Readiness        bool              `json:"readiness"`
}

type AdminTeamStatus struct {
	Name string `json:"name"`
}

type teamNotFoundError struct{}

func (e *teamNotFoundError) Error() string {
	return "team not found"
}

func handleTeamStatus(b *bundle.Bundle) http.Handler {
	challengesByKeys := make(map[string]bundle.JuiceShopChallenge)
	for _, challenge := range b.JuiceShopChallenges {
		challengesByKeys[challenge.Key] = challenge
	}

	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			teamParam := req.PathValue("team")

			// Determine which team to fetch status for
			var team string

			if teamParam == "" || teamParam == "me" {
				// No team parameter or "me" - return current logged-in team's status
				var err error
				team, err = teamcookie.GetTeamFromRequest(b, req)
				if err != nil {
					http.Error(responseWriter, "", http.StatusNotFound)
					return
				}

				if team == "admin" {
					responseBytes, err := json.Marshal(AdminTeamStatus{Name: "admin"})
					if err != nil {
						b.Log.Printf("Failed to marshal response: %s", err)
						http.Error(responseWriter, "", http.StatusInternalServerError)
						return
					}

					responseWriter.Header().Set("Content-Type", "application/json")
					responseWriter.WriteHeader(http.StatusOK)
					responseWriter.Write(responseBytes)
					return
				}
			} else {
				// Specific team requested
				if !isValidTeamName(teamParam) {
					http.Error(responseWriter, "invalid team name", http.StatusBadRequest)
					return
				}
				team = teamParam
			}

			// Define the fetch function for long polling
			fetchFunc := func(ctx context.Context, waitAfter *time.Time) (*bundle.TeamScore, time.Time, bool, error) {
				if waitAfter != nil {
					teamScore := b.ScoringService.WaitForTeamUpdatesNewerThan(ctx, team, *waitAfter)
					if teamScore == nil {
						return nil, time.Time{}, false, nil
					}
					return teamScore, teamScore.LastUpdate, true, nil
				}
				teamScore, ok := b.ScoringService.GetScoreForTeam(team)
				if !ok {
					// Return error to trigger 404
					return nil, time.Time{}, false, &teamNotFoundError{}
				}
				return teamScore, teamScore.LastUpdate, true, nil
			}

			teamScore, lastUpdateTime, statusCode, err := longpoll.HandleLongPoll(req, fetchFunc)
			if err != nil {
				if _, ok := err.(*teamNotFoundError); ok {
					http.Error(responseWriter, "team not found", http.StatusNotFound)
					return
				}
				b.Log.Printf("Long poll error: %s", err)
				http.Error(responseWriter, "Invalid time format", statusCode)
				return
			}
			if statusCode == http.StatusNoContent {
				responseWriter.WriteHeader(http.StatusNoContent)
				responseWriter.Write([]byte{})
				return
			}

			teamCount := len(b.ScoringService.GetScores())
			// Build solved challenges array
			solvedChallenges := make([]SolvedChallenge, len(teamScore.Challenges))
			for i, challenge := range teamScore.Challenges {
				solvedChallenges[i] = SolvedChallenge{
					Key:        challenge.Key,
					Name:       challengesByKeys[challenge.Key].Name,
					Difficulty: challengesByKeys[challenge.Key].Difficulty,
					SolvedAt:   challenge.SolvedAt.Format(time.RFC3339),
				}
			}

			response := TeamStatus{
				Name:             team,
				Score:            teamScore.Score,
				Position:         teamScore.Position,
				TotalTeams:       teamCount,
				SolvedChallenges: solvedChallenges,
				Readiness:        teamScore.InstanceReadiness,
			}

			responseBytes, err := json.Marshal(response)
			if err != nil {
				b.Log.Printf("Failed to marshal response: %s", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Header().Set("X-Last-Update", lastUpdateTime.UTC().Format(time.RFC3339Nano))
			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write(responseBytes)
		},
	)
}
