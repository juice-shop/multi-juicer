package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestTeamStatusHandler(t *testing.T) {
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

	t.Run("returns the instance status", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
			createTeam("barfoo", `[]`, "0"),
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
		assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"solvedChallenges":1,"totalTeams":2,"readiness":true}`, rr.Body.String())
	})

	t.Run("returns -1 for position and score if it hasn't been calculated yet", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(createTeam("other-team", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"))
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)
		scoring.CalculateAndCacheScoreBoard(context.Background(), bundle, map[string]b.JuiceShopChallenge{
			"scoreBoardChallenge": {
				Key:        "scoreBoardChallenge",
				Difficulty: 1,
			},
		})
		clientset.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Create(context.Background(), createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"), metav1.CreateOptions{})

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"name":"foobar","score":-1,"position":-1,"solvedChallenges":0,"totalTeams":2,"readiness":true}`, rr.Body.String())
	})

	t.Run("returns a 404 if the team doesn't have a deployment", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		assert.Contains(t, rr.Body.String(), "team not found")
	})

	t.Run("returns a 401 if the balancer cookie isn't signed", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/teams/%s/wait-till-ready", team), nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", team))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", strings.TrimSpace(rr.Body.String()))
	})
}
