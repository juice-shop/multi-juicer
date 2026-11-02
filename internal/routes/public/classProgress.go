package public

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	b "github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/longpoll"
)

type ClassProgressChallenge struct {
	Key        string `json:"key"`
	Name       string `json:"name"`
	SolveCount int    `json:"solveCount"`
}

type ClassProgressTeam struct {
	Name             string   `json:"name"`
	MandatorySolved  int      `json:"mandatorySolved"`
	SuggestedSolved  int      `json:"suggestedSolved"`
	SolvedChallenges []string `json:"solvedChallenges"`
}

type ClassProgressResponse struct {
	Mandatory []ClassProgressChallenge `json:"mandatory"`
	Suggested []ClassProgressChallenge `json:"suggested"`
	Teams     []ClassProgressTeam      `json:"teams"`
}

func handleClassProgress(bundle *b.Bundle) http.Handler {
	challengesByKeys := make(map[string]b.JuiceShopChallenge)
	for _, challenge := range bundle.JuiceShopChallenges {
		challengesByKeys[challenge.Key] = challenge
	}

	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			classProgress := bundle.Config.ClassProgress
			if len(classProgress.Mandatory) == 0 && len(classProgress.Suggested) == 0 {
				http.Error(responseWriter, "class progress is not configured", http.StatusNotFound)
				return
			}

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

			responseBytes, err := json.Marshal(calculateClassProgress(classProgress, challengesByKeys, teamScores))
			if err != nil {
				bundle.Log.Error("Failed to marshal response", "error", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Header().Set("X-Last-Update", lastUpdateTime.UTC().Format(time.RFC3339Nano))
			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write(responseBytes) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter.no-direct-write-to-responsewriter
		},
	)
}

func calculateClassProgress(classProgress b.ClassProgressConfig, challengesByKeys map[string]b.JuiceShopChallenge, teamScores []*b.TeamScore) ClassProgressResponse {
	solveCounts := make(map[string]int)

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
		for _, key := range classProgress.Mandatory {
			if solved[key] {
				team.MandatorySolved++
				team.SolvedChallenges = append(team.SolvedChallenges, key)
				solveCounts[key]++
			}
		}
		for _, key := range classProgress.Suggested {
			if solved[key] {
				team.SuggestedSolved++
				team.SolvedChallenges = append(team.SolvedChallenges, key)
				solveCounts[key]++
			}
		}
		teams = append(teams, team)
	}

	toChallenges := func(keys []string) []ClassProgressChallenge {
		challenges := make([]ClassProgressChallenge, len(keys))
		for i, key := range keys {
			challenges[i] = ClassProgressChallenge{
				Key:        key,
				Name:       challengesByKeys[key].Name,
				SolveCount: solveCounts[key],
			}
		}
		return challenges
	}

	return ClassProgressResponse{
		Mandatory: toChallenges(classProgress.Mandatory),
		Suggested: toChallenges(classProgress.Suggested),
		Teams:     teams,
	}
}
