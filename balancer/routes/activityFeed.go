package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// EventType represents the type of activity event
type EventType string

const (
	EventTypeTeamCreated     EventType = "team_created"
	EventTypeChallengeSolved EventType = "challenge_solved"
)

// ActivityEvent is the interface that all activity events must implement
type ActivityEvent interface {
	GetEventType() EventType
	GetTeam() string
	GetTimestamp() time.Time
}

// BaseEvent contains common fields for all activity events
type BaseEvent struct {
	Team      string    `json:"team"`
	EventType EventType `json:"eventType"`
	Timestamp time.Time `json:"timestamp"`
}

func (e BaseEvent) GetEventType() EventType { return e.EventType }
func (e BaseEvent) GetTeam() string         { return e.Team }
func (e BaseEvent) GetTimestamp() time.Time { return e.Timestamp }

// TeamCreatedEvent represents a team joining the CTF
type TeamCreatedEvent struct {
	BaseEvent
}

// ChallengeSolvedEvent represents a team solving a challenge
type ChallengeSolvedEvent struct {
	BaseEvent
	ChallengeKey  string `json:"challengeKey"`
	ChallengeName string `json:"challengeName"`
	Points        int    `json:"points"`
	IsFirstSolve  bool   `json:"isFirstSolve,omitempty"`
}

// Type assertion helpers
func IsTeamCreatedEvent(event ActivityEvent) (*TeamCreatedEvent, bool) {
	e, ok := event.(*TeamCreatedEvent)
	return e, ok
}

func IsChallengeSolvedEvent(event ActivityEvent) (*ChallengeSolvedEvent, bool) {
	e, ok := event.(*ChallengeSolvedEvent)
	return e, ok
}

// ByTimestamp sorts events by their timestamp, newest first.
type ByTimestamp []ActivityEvent

func (a ByTimestamp) Len() int      { return len(a) }
func (a ByTimestamp) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a ByTimestamp) Less(i, j int) bool {
	return a[i].GetTimestamp().After(a[j].GetTimestamp())
}

// buildTeamCreationEvents constructs team creation events from deployments
func buildTeamCreationEvents(deployments []*appsv1.Deployment) []ActivityEvent {
	events := make([]ActivityEvent, 0, len(deployments))
	for _, deployment := range deployments {
		teamName, ok := deployment.Labels["team"]
		if !ok {
			continue
		}

		events = append(events, &TeamCreatedEvent{
			BaseEvent: BaseEvent{
				Team:      teamName,
				EventType: EventTypeTeamCreated,
				Timestamp: deployment.CreationTimestamp.Time,
			},
		})
	}
	return events
}

// buildActivityFeed constructs the activity feed from team scores and deployments
func buildActivityFeed(
	bundle *b.Bundle,
	allTeamScores map[string]*b.TeamScore,
	deployments []*appsv1.Deployment,
) []ActivityEvent {

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

			event := &ChallengeSolvedEvent{
				BaseEvent: BaseEvent{
					Team:      teamName,
					EventType: EventTypeChallengeSolved,
					Timestamp: solvedChallenge.SolvedAt,
				},
				ChallengeKey:  solvedChallenge.Key,
				ChallengeName: challengeDetails.Name,
				Points:        challengeDetails.Difficulty * 10,
			}
			allEvents = append(allEvents, event)

			// Track the earliest solve time for each challenge
			if firstTime, exists := firstSolves[solvedChallenge.Key]; !exists || solvedChallenge.SolvedAt.Before(firstTime) {
				firstSolves[solvedChallenge.Key] = solvedChallenge.SolvedAt
			}
		}
	}

	// 2. Add team creation events
	allEvents = append(allEvents, buildTeamCreationEvents(deployments)...)

	// 3. Add "First Solve" information
	for i := range allEvents {
		event := allEvents[i]
		if solvedEvent, ok := IsChallengeSolvedEvent(event); ok {
			if firstSolveTime, exists := firstSolves[solvedEvent.ChallengeKey]; exists && solvedEvent.GetTimestamp().Equal(firstSolveTime) {
				solvedEvent.IsFirstSolve = true
			}
		}
	}

	// 4. Sort all events chronologically (newest first)
	sort.Sort(ByTimestamp(allEvents))

	// 5. Limit to the 15 most recent events
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

			// Fetch all deployments from Kubernetes
			deploymentList, err := bundle.ClientSet.
				AppsV1().
				Deployments(bundle.RuntimeEnvironment.Namespace).
				List(ctx, metav1.ListOptions{
					LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
				})
			if err != nil {
				bundle.Log.Printf("Failed to list deployments for activity feed: %s", err)
				return nil, time.Time{}, false, err
			}

			deployments := make([]*appsv1.Deployment, len(deploymentList.Items))
			for i := range deploymentList.Items {
				deployments[i] = &deploymentList.Items[i]
			}

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
				activityFeed := buildActivityFeed(bundle, scoresMap, deployments)
				return activityFeed, lastUpdateTime, true, nil
			}
			allTeamScores, lastUpdateTime := bundle.ScoringService.GetTopScoresWithTimestamp()
			// Convert sorted team scores to map
			scoresMap := make(map[string]*b.TeamScore)
			for _, score := range allTeamScores {
				scoresMap[score.Name] = score
			}
			activityFeed := buildActivityFeed(bundle, scoresMap, deployments)
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
