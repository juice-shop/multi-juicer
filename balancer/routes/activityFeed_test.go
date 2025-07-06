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

	t.Run("with multiple solves, should return sorted events with correct first blood", func(t *testing.T) {
		// --- Test Data Setup ---
		challenge1 := "scoreBoardChallenge" // 10 points
		challenge2 := "nullByteChallenge"   // 40 points

		// Timestamps for sorting verification
		time1 := time.Now().Add(-30 * time.Minute) // Oldest
		time2 := time.Now().Add(-20 * time.Minute)
		time3 := time.Now().Add(-10 * time.Minute) // Newest

		// team-alpha: Solved challenge 1 at time 2
		teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challenge1, time2.Format(time.RFC3339))
		// team-bravo: Solved challenge 1 at time 1 (First Blood) and challenge 2 at time 3
		teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"},{"key":"%s","solvedAt":"%s"}]`,
			challenge1, time1.Format(time.RFC3339), challenge2, time3.Format(time.RFC3339))

		clientset := fake.NewSimpleClientset(
			createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
			createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err)

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		// --- Test Execution ---
		req, _ := http.NewRequest("GET", "/balancer/api/v2/activity-feed", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		// --- Assertions ---
		assert.Equal(t, http.StatusOK, rr.Code)

		var feed []ActivityEvent
		err = json.Unmarshal(rr.Body.Bytes(), &feed)
		require.NoError(t, err)

		require.Len(t, feed, 3, "Expected 3 total solve events in the feed")

		// 1. Verify sorting (newest first)
		assert.Equal(t, challenge2, feed[0].ChallengeKey, "The newest event should be at the top of the feed")
		assert.Equal(t, "team-bravo", feed[0].Team)
		assert.Equal(t, time3.UTC().Format(time.RFC3339Nano), feed[0].SolvedAt.UTC().Format(time.RFC3339Nano))

		assert.Equal(t, challenge1, feed[1].ChallengeKey)
		assert.Equal(t, "team-alpha", feed[1].Team)

		// 2. Verify First Blood detection
		var teamAlphaEvent, teamBravoC1Event, teamBravoC2Event ActivityEvent
		for _, event := range feed {
			if event.Team == "team-alpha" {
				teamAlphaEvent = event
			} else if event.ChallengeKey == challenge1 {
				teamBravoC1Event = event
			} else {
				teamBravoC2Event = event
			}
		}
		assert.False(t, teamAlphaEvent.IsFirstBlood, "Team Alpha's solve should not be First Blood")
		assert.True(t, teamBravoC1Event.IsFirstBlood, "Team Bravo's solve of challenge 1 should be First Blood")
		assert.True(t, teamBravoC2Event.IsFirstBlood, "Team Bravo's solve of challenge 2 should be First Blood (as they are the only solver)")

		// 3. Verify event details
		assert.Equal(t, "Score Board", teamBravoC1Event.ChallengeName)
		assert.Equal(t, 10, teamBravoC1Event.Points) // Difficulty 1 * 10
	})

	t.Run("with no solves, should return an empty array", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(
			createTeamWithSolvedChallenges("team-alpha", "[]"),
			createTeamWithSolvedChallenges("team-bravo", "[]"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		req, _ := http.NewRequest("GET", "/balancer/api/v2/activity-feed", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `[]`, rr.Body.String())
	})

	t.Run("with more than 15 solves, should return only the 15 newest events", func(t *testing.T) {
		var mockDeployments []runtime.Object
		var newestSolveTime time.Time
		// Create 20 solve events
		for i := 0; i < 20; i++ {
			solveTime := time.Now().Add(time.Duration(-i) * time.Minute)
			if i == 0 {
				newestSolveTime = solveTime
			}
			challengeJSON := fmt.Sprintf(`[{"key":"scoreBoardChallenge", "solvedAt":"%s"}]`, solveTime.Format(time.RFC3339))
			mockDeployments = append(mockDeployments, createTeamWithSolvedChallenges(fmt.Sprintf("team-%d", i), challengeJSON))
		}

		clientset := fake.NewSimpleClientset(mockDeployments...)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		req, _ := http.NewRequest("GET", "/balancer/api/v2/activity-feed", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		var feed []ActivityEvent
		err := json.Unmarshal(rr.Body.Bytes(), &feed)
		require.NoError(t, err)

		// Assert that the feed is limited to 15 items
		assert.Len(t, feed, 15, "Feed should be limited to 15 events")
		// Assert that the first item in the feed is the newest one we created
		assert.Equal(t, newestSolveTime.UTC().Format(time.RFC3339Nano), feed[0].SolvedAt.UTC().Format(time.RFC3339Nano))
	})
}
