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
	"k8s.io/client-go/kubernetes/fake"
)

func TestActivityFeedHandler(t *testing.T) {
	createTeamWithSolvedChallenges := func(team string, challengesJSON string) *appsv1.Deployment {
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

	// --- Test Case ---
	req, _ := http.NewRequest("GET", "/balancer/api/v2/activity-feed", nil)
	rr := httptest.NewRecorder()
	server.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	var feed []ActivityEvent
	err = json.Unmarshal(rr.Body.Bytes(), &feed)
	require.NoError(t, err)

	require.Len(t, feed, 3, "Expected 3 total solve events in the feed")

	// 1. Verify sorting (newest first)
	assert.Equal(t, challenge2, feed[0].ChallengeKey, "The newest event should be at the top of the feed")
	assert.Equal(t, "team-bravo", feed[0].Team)

	// 2. Verify First Blood detection
	// The first solve of challenge1 was by team-bravo at time1
	// The second solve of challenge1 was by team-alpha at time2
	// The event for team-alpha should NOT be first blood
	// The event for team-bravo SHOULD be first blood
	var teamAlphaEvent, teamBravoEvent ActivityEvent
	for _, event := range feed {
		if event.Team == "team-alpha" {
			teamAlphaEvent = event
		}
		if event.Team == "team-bravo" && event.ChallengeKey == challenge1 {
			teamBravoEvent = event
		}
	}
	assert.False(t, teamAlphaEvent.IsFirstBlood, "Team Alpha's solve should not be First Blood")
	assert.True(t, teamBravoEvent.IsFirstBlood, "Team Bravo's solve should be First Blood")

	// 3. Verify event details
	assert.Equal(t, "Score Board", teamBravoEvent.ChallengeName)
	assert.Equal(t, 10, teamBravoEvent.Points) // Difficulty 1 * 10
}
