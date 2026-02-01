package routes

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

// ChallengeSolve represents a team that has solved a particular challenge.
type ChallengeSolve struct {
	Team     string    `json:"team"`
	SolvedAt time.Time `json:"solvedAt"`
}

// ChallengeSolves is a slice of ChallengeSolve for sorting.
type ChallengeSolves []ChallengeSolve

func (s ChallengeSolves) Len() int           { return len(s) }
func (s ChallengeSolves) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s ChallengeSolves) Less(i, j int) bool { return s[i].SolvedAt.Before(s[j].SolvedAt) }

// ChallengeDetailResponse is the response payload for the challenge detail endpoint.
type ChallengeDetailResponse struct {
	Key         string          `json:"key"`
	Name        string          `json:"name"`
	Category    string          `json:"category"`
	Description string          `json:"description"`
	Difficulty  int             `json:"difficulty"`
	Solves      ChallengeSolves `json:"solves"`
}

func handleChallengeDetail(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		challengeKey := r.PathValue("challengeKey")

		// 1. Find the challenge details from the bundle's pre-loaded list.
		var targetChallenge *b.JuiceShopChallenge
		for i := range bundle.JuiceShopChallenges {
			if bundle.JuiceShopChallenges[i].Key == challengeKey {
				targetChallenge = &bundle.JuiceShopChallenges[i]
				break
			}
		}

		if targetChallenge == nil {
			http.Error(w, "Challenge not found", http.StatusNotFound)
			return
		}

		// 2. Iterate through all teams and their solved challenges to find who solved this one.
		solves := make(ChallengeSolves, 0)
		allTeamScores := bundle.ScoringService.GetScores()

		for teamName, teamScore := range allTeamScores {
			for _, solvedChallenge := range teamScore.Challenges {
				if solvedChallenge.Key == challengeKey {
					solves = append(solves, ChallengeSolve{
						Team:     teamName,
						SolvedAt: solvedChallenge.SolvedAt,
					})
					break // Move to the next team
				}
			}
		}

		// 3. Sort the solves by time to show "First Solve" first.
		sort.Sort(solves)

		// 4. Construct and send the response.
		response := ChallengeDetailResponse{
			Key:         targetChallenge.Key,
			Name:        targetChallenge.Name,
			Category:    targetChallenge.Category,
			Description: targetChallenge.Description,
			Difficulty:  targetChallenge.Difficulty,
			Solves:      solves,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})
}
