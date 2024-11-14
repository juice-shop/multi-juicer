package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestIndividualScoreHandler(t *testing.T) {
	team := "foobar"

	createTeam := func(team string, challenges string, solvedChallenges string) *appsv1.Deployment {
		return &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":       challenges,
					"multi-juicer.owasp-juice.shop/challengesSolved": solvedChallenges,
				},
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
					"team":                      team,
				},
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas: 1,
			},
		}
	}

	t.Run("returns the individual score of a team", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/score-board/teams/%s/score", team), nil)
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(
			createTeam(team, `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoring.CalculateAndCacheScoreBoard(context.Background(), bundle, map[string]b.JuiceShopChallenge{
			"scoreBoardChallenge": {
				Key:        "scoreBoardChallenge",
				Difficulty: 1,
			},
		})
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"solvedChallenges":["scoreBoardChallenge"],"totalTeams":1}`, rr.Body.String())
	})

	t.Run("returns a 404 if the scores haven't been calculated yet", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/score-board/teams/%s/score", team), nil)
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)
		scoring.CalculateAndCacheScoreBoard(context.Background(), bundle, map[string]b.JuiceShopChallenge{
			"scoreBoardChallenge": {
				Key:        "scoreBoardChallenge",
				Difficulty: 1,
			},
		})
		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("returns a 400 if the teamname is invalid", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/score-board/teams/%s/score", "invälid"), nil)
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}
