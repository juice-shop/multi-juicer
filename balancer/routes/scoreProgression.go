package routes

import (
	"encoding/json"
	"net/http"
	"sort"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
)

// DataPoint represents a single point in time for a team's score.
type DataPoint struct {
	Time  time.Time `json:"time"`
	Score int       `json:"score"`
}

// TeamSeries is a series of data points for a single team.
type TeamSeries struct {
	Team       string      `json:"team"`
	DataPoints []DataPoint `json:"datapoints"`
}

// solveEvent is a temporary struct for processing solves.
type solveEvent struct {
	Team   string
	Points int
	Time   time.Time
}

type byTime []solveEvent

func (a byTime) Len() int           { return len(a) }
func (a byTime) Swap(i, j int)      { a[i], a[j] = a[j], a[i] }
func (a byTime) Less(i, j int) bool { return a[i].Time.Before(a[j].Time) }

func handleScoreProgression(bundle *b.Bundle, scoringService *scoring.ScoringService) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		challengeMap := make(map[string]b.JuiceShopChallenge)
		for _, ch := range bundle.JuiceShopChallenges {
			challengeMap[ch.Key] = ch
		}

		// 1. Get the current top 10 teams
		topTeams := scoringService.GetTopScores()
		limit := 10
		if len(topTeams) < limit {
			limit = len(topTeams)
		}
		topTeamSet := make(map[string]bool)
		for i := 0; i < limit; i++ {
			topTeamSet[topTeams[i].Name] = true
		}

		// 2. Collect all solve events ONLY for the top teams
		allEvents := make([]solveEvent, 0)
		for _, teamScore := range topTeams[:limit] {
			for _, solvedChallenge := range teamScore.Challenges {
				if challengeDetails, ok := challengeMap[solvedChallenge.Key]; ok {
					allEvents = append(allEvents, solveEvent{
						Team:   teamScore.Name,
						Points: challengeDetails.Difficulty * 10,
						Time:   solvedChallenge.SolvedAt,
					})
				}
			}
		}

		// 3. Sort all events chronologically
		sort.Sort(byTime(allEvents))

		// 4. Reconstruct the score history
		history := make(map[string][]DataPoint)
		currentScores := make(map[string]int)

		// Determine the start time for the chart. Use a time just before the first event,
		// or the current time if there are no events.
		startTime := time.Now()
		if len(allEvents) > 0 {
			// Set start time to one second before the very first event
			startTime = allEvents[0].Time.Add(-1 * time.Second)
		}

		for teamName := range topTeamSet {
			// Initialize each team with a starting point at score 0.
			history[teamName] = []DataPoint{{Time: startTime, Score: 0}}
			currentScores[teamName] = 0
		}

		for _, event := range allEvents {
			// For every other team that is NOT the current event's team,
			// we add a point to their timeline at the event's timestamp.
			// This ensures their line stays flat until their next solve.
			for teamName := range topTeamSet {
				if teamName != event.Team {
					history[teamName] = append(history[teamName], DataPoint{Time: event.Time, Score: currentScores[teamName]})
				}
			}

			// Update the score for the team that solved the challenge
			currentScores[event.Team] += event.Points
			history[event.Team] = append(history[event.Team], DataPoint{Time: event.Time, Score: currentScores[event.Team]})
		}

		// 5. Format for the response
		response := make([]TeamSeries, 0, len(history))
		for team, dataPoints := range history {
			response = append(response, TeamSeries{Team: team, DataPoints: dataPoints})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})
}
