package routes

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

type teamSolveEntry struct {
	ChallengeKey string    `json:"challengeKey"`
	SolvedAt     time.Time `json:"solvedAt"`
}

type teamSolvesItem struct {
	Team   string           `json:"team"`
	Solves []teamSolveEntry `json:"solves"`
}

type teamSolvesResponse struct {
	Teams []teamSolvesItem `json:"teams"`
}

func handleTeamSolves(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allTeamScores := bundle.ScoringService.GetScores()

		teams := make([]teamSolvesItem, 0, len(allTeamScores))
		for teamName, teamScore := range allTeamScores {
			if len(teamScore.Challenges) == 0 {
				continue
			}

			solves := make([]teamSolveEntry, len(teamScore.Challenges))
			for i, c := range teamScore.Challenges {
				solves[i] = teamSolveEntry{
					ChallengeKey: c.Key,
					SolvedAt:     c.SolvedAt,
				}
			}

			sort.Slice(solves, func(i, j int) bool {
				return solves[i].SolvedAt.Before(solves[j].SolvedAt)
			})

			teams = append(teams, teamSolvesItem{
				Team:   teamName,
				Solves: solves,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(teamSolvesResponse{Teams: teams})
	})
}
