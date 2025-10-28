package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

type TeamStatus struct {
	Name             string `json:"name"`
	Score            int    `json:"score"`
	SolvedChallenges int    `json:"solvedChallenges"`
	Position         int    `json:"position"`
	TotalTeams       int    `json:"totalTeams"`
	Readiness        bool   `json:"readiness"`
}

type AdminTeamStatus struct {
	Name string `json:"name"`
}

func handleTeamStatus(bundle *bundle.Bundle, scoringService *scoring.ScoringService) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			if team == "admin" {
				responseBytes, err := json.Marshal(AdminTeamStatus{Name: "admin"})
				if err != nil {
					bundle.Log.Printf("Failed to marshal response: %s", err)
					http.Error(responseWriter, "", http.StatusInternalServerError)
					return
				}

				responseWriter.Header().Set("Content-Type", "application/json")
				responseWriter.WriteHeader(http.StatusOK)
				responseWriter.Write(responseBytes)
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
					teamScore = &scoring.TeamScore{
						Name:              team,
						Score:             -1,
						Position:          -1,
						Challenges:        []scoring.ChallengeProgress{},
						InstanceReadiness: false,
					}
				}
				return teamScore, time.Now(), true, nil
			}

			teamScore, _, statusCode, err := longpoll.HandleLongPoll(req, fetchFunc)
			if err != nil {
				bundle.Log.Printf("Long poll error: %s", err)
				http.Error(responseWriter, "Invalid time format", statusCode)
				return
			}
			if statusCode == http.StatusNoContent {
				responseWriter.WriteHeader(http.StatusNoContent)
				responseWriter.Write([]byte{})
				return
			}

			response := TeamStatus{
				Name:             team,
				Score:            teamScore.Score,
				Position:         teamScore.Position,
				TotalTeams:       len(scoringService.GetScores()),
				SolvedChallenges: len(teamScore.Challenges),
				Readiness:        teamScore.InstanceReadiness,
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
