package routes

import (
	"encoding/json"
	"net/http"
	"strings"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

// ChallengeListItem represents a challenge in the list response.
type ChallengeListItem struct {
	Key         string  `json:"key"`
	Name        string  `json:"name"`
	Category    string  `json:"category"`
	Description string  `json:"description"`
	Difficulty  int     `json:"difficulty"`
	SolveCount  int     `json:"solveCount"`
	FirstSolver *string `json:"firstSolver"`
}

// ChallengesListResponse is the response payload for the challenges list endpoint.
type ChallengesListResponse struct {
	Challenges []ChallengeListItem `json:"challenges"`
}

func handleChallenges(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get all team scores to calculate solve counts
		allTeamScores := bundle.ScoringService.GetScores()

		// Create a map to count solves per challenge
		solveCounts := make(map[string]int)

		// Track first solver for each challenge (key -> team name and earliest solve time)
		type solveInfo struct {
			team     string
			solvedAt b.ChallengeProgress
		}
		firstSolvers := make(map[string]solveInfo)

		for _, teamScore := range allTeamScores {
			for _, solvedChallenge := range teamScore.Challenges {
				solveCounts[solvedChallenge.Key]++

				// Track first solver
				if existing, found := firstSolvers[solvedChallenge.Key]; !found || solvedChallenge.SolvedAt.Before(existing.solvedAt.SolvedAt) {
					firstSolvers[solvedChallenge.Key] = solveInfo{
						team:     teamScore.Name,
						solvedAt: solvedChallenge,
					}
				}
			}
		}

		// Build the response with all challenges
		challenges := make([]ChallengeListItem, 0, len(bundle.JuiceShopChallenges))
		for _, challenge := range bundle.JuiceShopChallenges {
			var firstSolver *string
			if info, found := firstSolvers[challenge.Key]; found {
				firstSolver = &info.team
			}

			description := strings.ReplaceAll(challenge.Description, "<i class=\"far fa-gem\"></i>", "💎")
			description = strings.ReplaceAll(description, "<i class=\"fab fa-btc fa-sm\"></i>", "💰")

			challenges = append(challenges, ChallengeListItem{
				Key:         challenge.Key,
				Name:        challenge.Name,
				Category:    challenge.Category,
				Description: description,
				Difficulty:  challenge.Difficulty,
				SolveCount:  solveCounts[challenge.Key],
				FirstSolver: firstSolver,
			})
		}

		response := ChallengesListResponse{
			Challenges: challenges,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})
}
