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

		clientset := fake.NewClientset(
			createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
			createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService, nil)

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

		// Verify first solvers
		require.NotNil(t, challenge1.FirstSolver, "Challenge 1 should have a first solver")
		assert.Equal(t, "team-alpha", *challenge1.FirstSolver, "team-alpha solved challenge 1 first (earlier timestamp)")
		require.NotNil(t, challenge2.FirstSolver, "Challenge 2 should have a first solver")
		assert.Equal(t, "team-bravo", *challenge2.FirstSolver, "team-bravo was the only solver of challenge 2")

		// Verify that challenge details are present
		assert.NotEmpty(t, challenge1.Name)
		assert.NotEmpty(t, challenge1.Key)
		assert.Greater(t, challenge1.Difficulty, 0)
	})

	t.Run("should return all challenges with zero solve counts when no teams have solved anything", func(t *testing.T) {
		// Setup with teams that have no solved challenges
		clientset := fake.NewClientset(
			createTeamWithSolvedChallenges("team-alpha", "[]"),
			createTeamWithSolvedChallenges("team-bravo", "[]"),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService, nil)

		req, _ := http.NewRequest("GET", "/balancer/api/challenges", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengesListResponse
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		// Verify that we got all challenges
		assert.Greater(t, len(response.Challenges), 0, "Should return at least one challenge")

		// Verify that all challenges have zero solves and no first solver
		for _, challenge := range response.Challenges {
			assert.Equal(t, 0, challenge.SolveCount, "All challenges should have 0 solves")
			assert.Nil(t, challenge.FirstSolver, "All challenges should have nil firstSolver when unsolved")
			assert.NotEmpty(t, challenge.Key)
			assert.NotEmpty(t, challenge.Name)
		}
	})

	t.Run("should return all challenges even when no teams exist", func(t *testing.T) {
		// Setup with no teams
		clientset := fake.NewClientset()

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService, nil)

		req, _ := http.NewRequest("GET", "/balancer/api/challenges", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengesListResponse
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		// Verify that we got all challenges from the bundle
		assert.Greater(t, len(response.Challenges), 0, "Should return at least one challenge")

		// Verify that all challenges have zero solves and no first solver
		for _, challenge := range response.Challenges {
			assert.Equal(t, 0, challenge.SolveCount, "All challenges should have 0 solves when no teams exist")
			assert.Nil(t, challenge.FirstSolver, "All challenges should have nil firstSolver when no teams exist")
		}
	})

	t.Run("should correctly identify first solver based on earliest timestamp", func(t *testing.T) {
		const challengeKey = "scoreBoardChallenge"

		// Create timestamps with team-charlie solving first, then team-alpha, then team-bravo
		solveTimeCharlie := time.Now().Add(-30 * time.Minute) // Earliest
		solveTimeAlpha := time.Now().Add(-20 * time.Minute)   // Middle
		solveTimeBravo := time.Now().Add(-10 * time.Minute)   // Latest

		teamCharlieChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challengeKey, solveTimeCharlie.Format(time.RFC3339))
		teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challengeKey, solveTimeAlpha.Format(time.RFC3339))
		teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challengeKey, solveTimeBravo.Format(time.RFC3339))

		clientset := fake.NewClientset(
			createTeamWithSolvedChallenges("team-charlie", teamCharlieChallenges),
			createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
			createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		require.NoError(t, err, "Setup: failed to calculate initial scoreboard")

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService, nil)

		req, _ := http.NewRequest("GET", "/balancer/api/challenges", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengesListResponse
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		require.NoError(t, err)

		// Find the challenge
		var challenge *ChallengeListItem
		for i := range response.Challenges {
			if response.Challenges[i].Key == challengeKey {
				challenge = &response.Challenges[i]
				break
			}
		}

		require.NotNil(t, challenge, "Challenge should be in the response")
		assert.Equal(t, 3, challenge.SolveCount, "Challenge should have 3 solves")
		require.NotNil(t, challenge.FirstSolver, "Challenge should have a first solver")
		assert.Equal(t, "team-charlie", *challenge.FirstSolver, "team-charlie should be first solver (earliest timestamp)")
	})
}
