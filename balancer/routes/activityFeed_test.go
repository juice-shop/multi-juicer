package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

// Helper to unmarshal activity events from JSON
func unmarshalActivityFeed(data []byte) ([]ActivityEvent, error) {
	var rawEvents []json.RawMessage
	if err := json.Unmarshal(data, &rawEvents); err != nil {
		return nil, err
	}

	events := make([]ActivityEvent, 0, len(rawEvents))
	for _, raw := range rawEvents {
		// First unmarshal to determine event type
		var base BaseEvent
		if err := json.Unmarshal(raw, &base); err != nil {
			return nil, err
		}

		switch base.EventType {
		case EventTypeTeamCreated:
			var event TeamCreatedEvent
			if err := json.Unmarshal(raw, &event); err != nil {
				return nil, err
			}
			events = append(events, &event)
		case EventTypeChallengeSolved:
			var event ChallengeSolvedEvent
			if err := json.Unmarshal(raw, &event); err != nil {
				return nil, err
			}
			events = append(events, &event)
		}
	}

	return events, nil
}

// Helper to create mock deployments with solved challenges
func createTeamWithSolvedChallenges(team string, challengesJSON string) *appsv1.Deployment {
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("juiceshop-%s", team),
			Namespace: "test-namespace",
			Annotations: map[string]string{
				"multi-juicer.owasp-juice.shop/challenges": challengesJSON,
			},
			Labels: map[string]string{"app.kubernetes.io/name": "juice-shop", "app.kubernetes.io/part-of": "multi-juicer", "team": team},
		},
		Status: appsv1.DeploymentStatus{ReadyReplicas: 1},
	}
}

func TestActivityFeedHandler(t *testing.T) {

	t.Run("with multiple solves, should return sorted events with correct first solve", func(t *testing.T) {
		// --- Test Data Setup ---
		challenge1 := "scoreBoardChallenge" // 10 points
		challenge2 := "nullByteChallenge"   // 40 points

		// Timestamps for sorting verification
		time1 := time.Now().Add(-30 * time.Minute) // Oldest
		time2 := time.Now().Add(-20 * time.Minute)
		time3 := time.Now().Add(-10 * time.Minute) // Newest

		// team-alpha: Solved challenge 1 at time 2
		teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challenge1, time2.Format(time.RFC3339))
		// team-bravo: Solved challenge 1 at time 1 (First Solve) and challenge 2 at time 3
		teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"},{"key":"%s","solvedAt":"%s"}]`,
			challenge1, time1.Format(time.RFC3339), challenge2, time3.Format(time.RFC3339))

		clientset := fake.NewClientset(
			createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
			createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err)

		server := http.NewServeMux()
		bundle.ScoringService = scoringService
		AddRoutes(server, bundle)

		// --- Test Execution ---
		req, _ := http.NewRequest("GET", "/balancer/api/activity-feed", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		// --- Assertions ---
		assert.Equal(t, http.StatusOK, rr.Code)

		feed, err := unmarshalActivityFeed(rr.Body.Bytes())
		require.NoError(t, err)

		require.Len(t, feed, 5, "Expected 3 solve events + 2 team creation events in the feed")

		// 1. Verify sorting (newest first)
		solvedEvent0, ok := IsChallengeSolvedEvent(feed[0])
		require.True(t, ok, "First event should be a challenge solved event")
		assert.Equal(t, challenge2, solvedEvent0.ChallengeKey, "The newest event should be at the top of the feed")
		assert.Equal(t, "team-bravo", solvedEvent0.GetTeam())
		assert.Equal(t, time3.UTC().Truncate(time.Second), solvedEvent0.GetTimestamp().UTC().Truncate(time.Second))

		solvedEvent1, ok := IsChallengeSolvedEvent(feed[1])
		require.True(t, ok, "Second event should be a challenge solved event")
		assert.Equal(t, challenge1, solvedEvent1.ChallengeKey)
		assert.Equal(t, "team-alpha", solvedEvent1.GetTeam())

		// 2. Verify First Solve detection
		var teamAlphaEvent, teamBravoC1Event, teamBravoC2Event *ChallengeSolvedEvent
		for _, event := range feed {
			if solvedEvent, ok := IsChallengeSolvedEvent(event); ok {
				if solvedEvent.GetTeam() == "team-alpha" {
					teamAlphaEvent = solvedEvent
				} else if solvedEvent.ChallengeKey == challenge1 {
					teamBravoC1Event = solvedEvent
				} else {
					teamBravoC2Event = solvedEvent
				}
			}
		}
		require.NotNil(t, teamAlphaEvent)
		require.NotNil(t, teamBravoC1Event)
		require.NotNil(t, teamBravoC2Event)
		assert.False(t, teamAlphaEvent.IsFirstSolve, "Team Alpha's solve should not be First Solve")
		assert.True(t, teamBravoC1Event.IsFirstSolve, "Team Bravo's solve of challenge 1 should be First Solve")
		assert.True(t, teamBravoC2Event.IsFirstSolve, "Team Bravo's solve of challenge 2 should be First Solve (as they are the only solver)")

		// 3. Verify event details
		assert.Equal(t, "Score Board", teamBravoC1Event.ChallengeName)
		assert.Equal(t, 10, teamBravoC1Event.Points) // Difficulty 1 * 10
	})

	t.Run("with no solves, should return an empty array", func(t *testing.T) {
		clientset := fake.NewClientset(
			createTeamWithSolvedChallenges("team-alpha", "[]"),
			createTeamWithSolvedChallenges("team-bravo", "[]"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		server := http.NewServeMux()
		bundle.ScoringService = scoringService
		AddRoutes(server, bundle)

		req, _ := http.NewRequest("GET", "/balancer/api/activity-feed", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		feed, err := unmarshalActivityFeed(rr.Body.Bytes())
		require.NoError(t, err)
		// Even with no solves, we expect team creation events
		require.Len(t, feed, 2, "Expected 2 team creation events")
		_, ok1 := IsTeamCreatedEvent(feed[0])
		assert.True(t, ok1, "First event should be a team created event")
		_, ok2 := IsTeamCreatedEvent(feed[1])
		assert.True(t, ok2, "Second event should be a team created event")
	})

	t.Run("with more than 30 solves, should return only the 30 newest events", func(t *testing.T) {
		var mockDeployments []runtime.Object
		var newestSolveTime time.Time
		// Create 20 solve events
		for i := range 20 {
			solveTime := time.Now().Add(time.Duration(-i) * time.Minute)
			if i == 0 {
				newestSolveTime = solveTime
			}
			challengeJSON := fmt.Sprintf(`[{"key":"scoreBoardChallenge", "solvedAt":"%s"}]`, solveTime.Format(time.RFC3339))
			mockDeployments = append(mockDeployments, createTeamWithSolvedChallenges(fmt.Sprintf("team-%d", i), challengeJSON))
		}

		clientset := fake.NewClientset(mockDeployments...)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		server := http.NewServeMux()
		bundle.ScoringService = scoringService
		AddRoutes(server, bundle)

		req, _ := http.NewRequest("GET", "/balancer/api/activity-feed", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		feed, err := unmarshalActivityFeed(rr.Body.Bytes())
		require.NoError(t, err)

		// Assert that the feed is limited to 30 items
		assert.Len(t, feed, 30, "Feed should be limited to 30 events")
		assert.Equal(t, newestSolveTime.UTC().Truncate(time.Second), feed[0].GetTimestamp().UTC().Truncate(time.Second))
	})
}
