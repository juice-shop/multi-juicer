package routes

import (
	"context"
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

	challengeKey := "scoreBoardChallenge"
	teamAlphaSolvedTime := time.Now().Add(-10 * time.Minute)
	teamBravoSolvedTime := time.Now().Add(-5 * time.Minute)

	clientset := fake.NewSimpleClientset(
		createTeamWithSolvedChallenges("team-alpha", fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challengeKey, teamAlphaSolvedTime.Format(time.RFC3339))),
		createTeamWithSolvedChallenges("team-bravo", fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challengeKey, teamBravoSolvedTime.Format(time.RFC3339))),
		createTeamWithSolvedChallenges("team-charlie", `[]`), // This team hasn't solved it
	)

	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	scoringService := scoring.NewScoringService(bundle)
	scoringService.CalculateAndCacheScoreBoard(context.Background()) // This populates the cache

	server := http.NewServeMux()
	AddRoutes(server, bundle, scoringService)

	t.Run("should return details and solvers for a valid challenge", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/v2/challenges/%s", challengeKey), nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

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

	t.Run("should return 404 for an invalid challenge", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/v2/challenges/non-existent-challenge", nil)
		rr := httptest.NewRecorder()
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})
}
