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

func TestChallengesHandler(t *testing.T) {
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

	t.Run("should return all challenges with solve counts", func(t *testing.T) {
		const challenge1Key = "scoreBoardChallenge"
		const challenge2Key = "nullByteChallenge"

		solveTime1 := time.Now().Add(-20 * time.Minute)
		solveTime2 := time.Now().Add(-10 * time.Minute)

		// Setup: team-alpha solves challenge1, team-bravo solves both challenges
		teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challenge1Key, solveTime1.Format(time.RFC3339))
		teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"},{"key":"%s","solvedAt":"%s"}]`,
			challenge1Key, solveTime2.Format(time.RFC3339),
			challenge2Key, solveTime2.Format(time.RFC3339))

		clientset := fake.NewSimpleClientset(
			createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
			createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		req, _ := http.NewRequest("GET", "/balancer/api/challenges", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengesListResponse
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		// Verify that we got all challenges from the bundle
		assert.Greater(t, len(response.Challenges), 0, "Should return at least one challenge")

		// Find specific challenges to verify solve counts
		var challenge1, challenge2 *ChallengeListItem
		for i := range response.Challenges {
			if response.Challenges[i].Key == challenge1Key {
				challenge1 = &response.Challenges[i]
			}
			if response.Challenges[i].Key == challenge2Key {
				challenge2 = &response.Challenges[i]
			}
		}

		require.NotNil(t, challenge1, "Challenge 1 should be in the response")
		require.NotNil(t, challenge2, "Challenge 2 should be in the response")

		// Verify solve counts
		assert.Equal(t, 2, challenge1.SolveCount, "Challenge 1 should have 2 solves")
		assert.Equal(t, 1, challenge2.SolveCount, "Challenge 2 should have 1 solve")

		// Verify that challenge details are present
		assert.NotEmpty(t, challenge1.Name)
		assert.NotEmpty(t, challenge1.Key)
		assert.Greater(t, challenge1.Difficulty, 0)
	})

	t.Run("should return all challenges with zero solve counts when no teams have solved anything", func(t *testing.T) {
		// Setup with teams that have no solved challenges
		clientset := fake.NewSimpleClientset(
			createTeamWithSolvedChallenges("team-alpha", "[]"),
			createTeamWithSolvedChallenges("team-bravo", "[]"),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		req, _ := http.NewRequest("GET", "/balancer/api/challenges", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengesListResponse
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		// Verify that we got all challenges
		assert.Greater(t, len(response.Challenges), 0, "Should return at least one challenge")

		// Verify that all challenges have zero solves
		for _, challenge := range response.Challenges {
			assert.Equal(t, 0, challenge.SolveCount, "All challenges should have 0 solves")
			assert.NotEmpty(t, challenge.Key)
			assert.NotEmpty(t, challenge.Name)
		}
	})

	t.Run("should return all challenges even when no teams exist", func(t *testing.T) {
		// Setup with no teams
		clientset := fake.NewSimpleClientset()

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		req, _ := http.NewRequest("GET", "/balancer/api/challenges", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengesListResponse
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		// Verify that we got all challenges from the bundle
		assert.Greater(t, len(response.Challenges), 0, "Should return at least one challenge")

		// Verify that all challenges have zero solves
		for _, challenge := range response.Challenges {
			assert.Equal(t, 0, challenge.SolveCount, "All challenges should have 0 solves when no teams exist")
		}
	})
}
