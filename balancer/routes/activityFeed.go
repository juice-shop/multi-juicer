package routes

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
)

// ActivityEvent represents a single event in the activity feed.
type ActivityEvent struct {
	Team          string    `json:"team"`
	ChallengeKey  string    `json:"challengeKey"`
	ChallengeName string    `json:"challengeName"`
	Points        int       `json:"points"`
	SolvedAt      time.Time `json:"solvedAt"`
	IsFirstSolve  bool      `json:"IsFirstSolve"`
}

// BySolvedAt sorts events by their timestamp, newest first.
type BySolvedAt []ActivityEvent

func (a BySolvedAt) Len() int           { return len(a) }
func (a BySolvedAt) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a BySolvedAt) Less(i, j int) bool { return a[i].SolvedAt.After(a[j].SolvedAt) }

func handleActivityFeed(bundle *b.Bundle, scoringService *scoring.ScoringService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allTeamScores := scoringService.GetScores()
		allEvents := make([]ActivityEvent, 0)
		firstSolves := make(map[string]time.Time) // Map challengeKey -> first solve time

		challengeMap := make(map[string]b.JuiceShopChallenge)
		for _, ch := range bundle.JuiceShopChallenges {
			challengeMap[ch.Key] = ch
		}

		// 1. Collect all solve events from all teams
		for teamName, teamScore := range allTeamScores {
			for _, solvedChallenge := range teamScore.Challenges {
				challengeDetails, ok := challengeMap[solvedChallenge.Key]
				if !ok {
					continue // Should not happen in a consistent system
				}

				event := ActivityEvent{
					Team:          teamName,
					ChallengeKey:  solvedChallenge.Key,
					ChallengeName: challengeDetails.Name,
					Points:        challengeDetails.Difficulty * 10,
					SolvedAt:      solvedChallenge.SolvedAt,
				}
				allEvents = append(allEvents, event)

				// Track the earliest solve time for each challenge
				if firstTime, exists := firstSolves[solvedChallenge.Key]; !exists || solvedChallenge.SolvedAt.Before(firstTime) {
					firstSolves[solvedChallenge.Key] = solvedChallenge.SolvedAt
				}
			}
		}

		// 2. Add "First Solve" information
		for i := range allEvents {
			event := &allEvents[i]
			if firstSolveTime, ok := firstSolves[event.ChallengeKey]; ok && event.SolvedAt.Equal(firstSolveTime) {
				event.IsFirstSolve = true
			}
		}

		// 3. Sort all events chronologically (newest first)
		sort.Sort(BySolvedAt(allEvents))

		// 4. Limit to the 15 most recent events
		limit := 15
		if len(allEvents) < limit {
			limit = len(allEvents)
		}
		recentEvents := allEvents[:limit]

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(recentEvents)
	})
}
