package public

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	b "github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/longpoll"
)

type ClassProgressTeam struct {
	Name             string   `json:"name"`
	SolvedChallenges []string `json:"solvedChallenges"`
}

type ClassProgressResponse struct {
	Teams []ClassProgressTeam `json:"teams"`
}

func handleClassProgress(bundle *b.Bundle) http.Handler {
	var groupChallengeKeys []string
	for _, group := range bundle.Config.Views.ClassProgress.Groups {
		groupChallengeKeys = append(groupChallengeKeys, group.Challenges...)
	}

	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			fetchFunc := func(ctx context.Context, waitAfter *time.Time) ([]*b.TeamScore, time.Time, bool, error) {
				if waitAfter != nil {
					teamScores, lastUpdateTime := bundle.ScoringService.WaitForUpdatesNewerThanWithTimestamp(ctx, *waitAfter)
					if teamScores == nil {
						return nil, time.Time{}, false, nil
					}
					return teamScores, lastUpdateTime, true, nil
				}
				teamScores, lastUpdateTime := bundle.ScoringService.GetTopScoresWithTimestamp()
				return teamScores, lastUpdateTime, true, nil
			}

			teamScores, lastUpdateTime, statusCode, err := longpoll.HandleLongPoll(req, fetchFunc)
			if err != nil {
				bundle.Log.Error("Long poll error", "error", err)
				http.Error(responseWriter, "Invalid time format", statusCode)
				return
			}
			if statusCode == http.StatusNoContent {
				responseWriter.WriteHeader(http.StatusNoContent)
				responseWriter.Write([]byte{}) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter.no-direct-write-to-responsewriter
				return
			}

			responseBytes, err := json.Marshal(calculateClassProgress(groupChallengeKeys, teamScores))
			if err != nil {
				bundle.Log.Error("Failed to marshal response", "error", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Header().Set("Last-Modified", lastUpdateTime.UTC().Format(time.RFC1123))
			responseWriter.Header().Set("X-Last-Update", lastUpdateTime.UTC().Format(time.RFC3339Nano))
			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write(responseBytes) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter.no-direct-write-to-responsewriter
		},
	)
}

func calculateClassProgress(groupChallengeKeys []string, teamScores []*b.TeamScore) ClassProgressResponse {
	teams := make([]ClassProgressTeam, 0, len(teamScores))
	for _, teamScore := range teamScores {
		solved := make(map[string]bool, len(teamScore.Challenges))
		for _, challenge := range teamScore.Challenges {
			solved[challenge.Key] = true
		}

		team := ClassProgressTeam{
			Name:             teamScore.Name,
			SolvedChallenges: []string{},
		}
		for _, key := range groupChallengeKeys {
			if solved[key] {
				team.SolvedChallenges = append(team.SolvedChallenges, key)
			}
		}
		teams = append(teams, team)
	}

	return ClassProgressResponse{Teams: teams}
}
