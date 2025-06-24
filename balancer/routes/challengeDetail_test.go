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
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestChallengeDetailHandler(t *testing.T) {
	// Helper to create mock deployments with solved challenges
	createTeamWithSolvedChallenges := func(team string, challengesJSON string) *appsv1.Deployment {
		return &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges": challengesJSON,
				},
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
					"team":                      team,
				},
			},
			Status: appsv1.DeploymentStatus{ReadyReplicas: 1},
		}
	}

	// --- Test Data Setup ---
	targetChallengeKey := "scoreBoardChallenge"
	otherChallengeKey := "nullByteChallenge"

	// Team Alpha solved the target challenge first, and another one
	teamAlphaSolvedTime := time.Now().Add(-10 * time.Minute)
	teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"},{"key":"%s","solvedAt":"%s"}]`,
		targetChallengeKey, teamAlphaSolvedTime.Format(time.RFC3339), otherChallengeKey, time.Now().Format(time.RFC3339))

	// Team Bravo solved the target challenge second
	teamBravoSolvedTime := time.Now().Add(-5 * time.Minute)
	teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, targetChallengeKey, teamBravoSolvedTime.Format(time.RFC3339))

	// Team Charlie has not solved the target challenge, but a different one
	teamCharlieChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, otherChallengeKey, time.Now().Format(time.RFC3339))

	clientset := fake.NewSimpleClientset(
		createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
		createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
		createTeamWithSolvedChallenges("team-charlie", teamCharlieChallenges),
	)

	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	scoringService := scoring.NewScoringService(bundle)
	scoringService.CalculateAndCacheScoreBoard(context.Background())

	server := http.NewServeMux()
	AddRoutes(server, bundle, scoringService)

	// --- Test Cases ---

	t.Run("should correctly filter teams and sort solves by time", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/v2/challenges/%s", targetChallengeKey), nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		// Note: The expected order is team-alpha first (first blood), then team-bravo.
		// The testutil bundle doesn't have category/description, so those are empty strings.
		expectedJSON := fmt.Sprintf(`{
			"key":"scoreBoardChallenge",
			"name":"Score Board",
			"category":"",
			"description":"",
			"difficulty":1,
			"solves":[
				{"team":"team-alpha","solvedAt":"%s"},
				{"team":"team-bravo","solvedAt":"%s"}
			]
		}`, teamAlphaSolvedTime.UTC().Format(time.RFC3339Nano), teamBravoSolvedTime.UTC().Format(time.RFC3339Nano))

		assert.JSONEq(t, expectedJSON, rr.Body.String())
	})

	t.Run("should return correct solves for a different challenge", func(t *testing.T) {
		// Our setup has team-alpha and team-charlie solving this challenge.
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/v2/challenges/%s", otherChallengeKey), nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ChallengeDetailResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, otherChallengeKey, response.Key)
		assert.Len(t, response.Solves, 2, "Expected two teams to have solved the nullByteChallenge")
	})

	t.Run("should return 404 for a non-existent challenge", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/v2/challenges/non-existent-challenge", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})
}
