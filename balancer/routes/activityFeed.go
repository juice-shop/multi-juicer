package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
)

// ActivityEvent represents a single event in the activity feed.
type ActivityEvent struct {
	Team          string    `json:"team"`
	ChallengeKey  string    `json:"challengeKey"`
	ChallengeName string    `json:"challengeName"`
	Points        int       `json:"points"`
	SolvedAt      time.Time `json:"solvedAt"`
	IsFirstSolve  bool      `json:"isFirstSolve"`
}

// BySolvedAt sorts events by their timestamp, newest first.
type BySolvedAt []ActivityEvent

func (a BySolvedAt) Len() int           { return len(a) }
func (a BySolvedAt) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a BySolvedAt) Less(i, j int) bool { return a[i].SolvedAt.After(a[j].SolvedAt) }

// buildActivityFeed constructs the activity feed from team scores
func buildActivityFeed(bundle *b.Bundle, allTeamScores map[string]*b.TeamScore) []ActivityEvent {
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

	return recentEvents
}

func handleActivityFeed(bundle *b.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Define the fetch function for long polling
		fetchFunc := func(ctx context.Context, waitAfter *time.Time) ([]ActivityEvent, time.Time, bool, error) {
			if waitAfter != nil {
				allTeamScores, lastUpdateTime := bundle.ScoringService.WaitForUpdatesNewerThanWithTimestamp(ctx, *waitAfter)
				if allTeamScores == nil {
					return nil, time.Time{}, false, nil
				}
				// Convert sorted team scores to map
				scoresMap := make(map[string]*b.TeamScore)
				for _, score := range allTeamScores {
					scoresMap[score.Name] = score
				}
				activityFeed := buildActivityFeed(bundle, scoresMap)
				return activityFeed, lastUpdateTime, true, nil
			}
			allTeamScores, lastUpdateTime := bundle.ScoringService.GetTopScoresWithTimestamp()
			// Convert sorted team scores to map
			scoresMap := make(map[string]*b.TeamScore)
			for _, score := range allTeamScores {
				scoresMap[score.Name] = score
			}
			activityFeed := buildActivityFeed(bundle, scoresMap)
			return activityFeed, lastUpdateTime, true, nil
		}

		recentEvents, lastUpdateTime, statusCode, err := longpoll.HandleLongPoll(r, fetchFunc)
		if err != nil {
			bundle.Log.Printf("Long poll error: %s", err)
			http.Error(w, "Invalid time format", statusCode)
			return
		}
		if statusCode == http.StatusNoContent {
			w.WriteHeader(http.StatusNoContent)
			w.Write([]byte{})
			return
		}

		responseBytes, marshalErr := json.Marshal(recentEvents)
		if marshalErr != nil {
			bundle.Log.Printf("Failed to marshal response: %s", marshalErr)
			http.Error(w, "", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Last-Modified", lastUpdateTime.UTC().Format(time.RFC1123))
		w.Header().Set("X-Last-Update", lastUpdateTime.UTC().Format(time.RFC3339Nano))
		w.WriteHeader(http.StatusOK)
		w.Write(responseBytes)
	})
}
