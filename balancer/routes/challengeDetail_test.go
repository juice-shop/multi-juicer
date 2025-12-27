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

func TestChallengeDetailHandler(t *testing.T) {
	// Helper to create mock deployments
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

	const solvedChallengeKey = "scoreBoardChallenge"
	const anotherChallengeKey = "nullByteChallenge" // This challenge exists but will have no solvers in our setup

	firstSolveTime := time.Now().Add(-20 * time.Minute)
	secondSolveTime := time.Now().Add(-10 * time.Minute)

	// Setup: team-alpha and team-bravo solve one challenge. No one solves the other.
	teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, solvedChallengeKey, secondSolveTime.Format(time.RFC3339))
	teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, solvedChallengeKey, firstSolveTime.Format(time.RFC3339))

	clientset := fake.NewClientset(
		createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
		createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
	)

	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	scoringService := scoring.NewScoringService(bundle)
	err := scoringService.CalculateAndCacheScoreBoard(context.Background())
	require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

	server := http.NewServeMux()
	AddRoutes(server, bundle, scoringService)

	t.Run("should return solvers in chronological order (First Solve first)", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/challenges/%s", solvedChallengeKey), nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengeDetailResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, solvedChallengeKey, response.Key)
		require.Len(t, response.Solves, 2, "Expected exactly two teams to have solved this challenge")

		// Verify the order and names
		assert.Equal(t, "team-bravo", response.Solves[0].Team, "Team Bravo should be first (First Solve)")
		assert.Equal(t, "team-alpha", response.Solves[1].Team, "Team Alpha should be second")
	})

	t.Run("should return an empty solves array for a challenge with no solves", func(t *testing.T) {
		// We query for `anotherChallengeKey` which exists in the test bundle but no team has solved it.
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/challenges/%s", anotherChallengeKey), nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengeDetailResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		assert.Equal(t, anotherChallengeKey, response.Key)
		assert.Empty(t, response.Solves, "The solves array should be empty for a challenge no one has solved")
	})

	t.Run("should return 404 for a non-existent challenge", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/challenges/this-challenge-does-not-exist", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})
}
