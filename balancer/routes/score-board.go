package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
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

func handleScoreBoard(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			// Define the fetch function for long polling
			fetchFunc := func(ctx context.Context, waitAfter *time.Time) ([]*b.TeamScore, time.Time, bool, error) {
				if waitAfter != nil {
					totalTeams, lastUpdateTime := bundle.ScoringService.WaitForUpdatesNewerThanWithTimestamp(ctx, *waitAfter)
					if totalTeams == nil {
						return nil, time.Time{}, false, nil
					}
					return totalTeams, lastUpdateTime, true, nil
				}
				totalTeams, lastUpdateTime := bundle.ScoringService.GetTopScoresWithTimestamp()
				return totalTeams, lastUpdateTime, true, nil
			}

			totalTeams, lastUpdateTime, statusCode, err := longpoll.HandleLongPoll(req, fetchFunc)
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

			var topTeams []*b.TeamScore
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

			responseBytes, marshalErr := json.Marshal(response)
			if marshalErr != nil {
				bundle.Log.Printf("Failed to marshal response: %s", marshalErr)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Header().Set("Last-Modified", lastUpdateTime.UTC().Format(time.RFC1123))
			responseWriter.Header().Set("X-Last-Update", lastUpdateTime.UTC().Format(time.RFC3339Nano))
			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write(responseBytes)
		},
	)
}
