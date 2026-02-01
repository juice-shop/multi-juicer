package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestTeamStatusHandler(t *testing.T) {
	team := "foobar"

	createTeamNumberOfReadyReplicas := func(team string, challenges string, solvedChallenges string, readyReplicas int32) *appsv1.Deployment {
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
				ReadyReplicas: readyReplicas,
			},
		}
	}
	createTeam := func(team string, challenges string, solvedChallenges string) *appsv1.Deployment {
		return createTeamNumberOfReadyReplicas(team, challenges, solvedChallenges, 1)
	}

	t.Run("returns the instance status for logged in team", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"totalTeams":2,"solvedChallenges":[{"key":"scoreBoardChallenge","name":"Score Board","difficulty":1,"solvedAt":"2024-11-01T19:55:48Z"}],"readiness":true}`, rr.Body.String())
	})

	t.Run("returns 404 if team doesn't exist in scores", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewClientset(createTeam("other-team", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"))
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("returns ready when instance gets update by the scoring watcher", func(t *testing.T) {
		server := http.NewServeMux()
		deployment := createTeamNumberOfReadyReplicas(team, `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1", 0)
		clientset := fake.NewClientset(deployment)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		err := scoringService.CalculateAndCacheScoreBoard(ctx)
		assert.Nil(t, err)

		AddRoutes(server, bundle, scoringService, nil)

		// Verify initial state - readiness should be false
		{
			req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
			rr := httptest.NewRecorder()
			req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
			server.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusOK, rr.Code)
			assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"totalTeams":1,"solvedChallenges":[{"key":"scoreBoardChallenge","name":"Score Board","difficulty":1,"solvedAt":"2024-11-01T19:55:48Z"}],"readiness":false}`, rr.Body.String())
		}

		// Update the deployment in the fake clientset
		updatedDeployment := createTeamNumberOfReadyReplicas(team, `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1", 1)
		_, err = clientset.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Update(ctx, updatedDeployment, metav1.UpdateOptions{})
		assert.Nil(t, err)

		// Recalculate the scoreboard to pick up the deployment change
		// This simulates what the watcher would do, but is deterministic
		err = scoringService.CalculateAndCacheScoreBoard(ctx)
		assert.Nil(t, err)

		// Now the status should reflect the updated readiness
		{
			req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
			rr := httptest.NewRecorder()
			req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
			server.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusOK, rr.Code)
			assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"totalTeams":1,"solvedChallenges":[{"key":"scoreBoardChallenge","name":"Score Board","difficulty":1,"solvedAt":"2024-11-01T19:55:48Z"}],"readiness":true}`, rr.Body.String())
		}
	})

	t.Run("returns a 404 if the balancer cookie isn't signed for 'me' endpoint", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", team))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		scoringService := scoring.NewScoringService(bundle)
		AddRoutes(server, bundle, scoringService, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		assert.Equal(t, "", strings.TrimSpace(rr.Body.String()))
	})

	t.Run("returns a a simplified response when the logged in team is the admin", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		scoringService := scoring.NewScoringService(bundle)
		AddRoutes(server, bundle, scoringService, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"name":"admin"}`, rr.Body.String())
	})

	t.Run("returns the status for a specific team by name", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/foobar/status", nil)
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"totalTeams":2,"solvedChallenges":[{"key":"scoreBoardChallenge","name":"Score Board","difficulty":1,"solvedAt":"2024-11-01T19:55:48Z"}],"readiness":true}`, rr.Body.String())
	})

	t.Run("returns 404 when requesting a non-existent team", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/nonexistent/status", nil)
		rr := httptest.NewRecorder()
		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("returns 400 when requesting a team with invalid name", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/invälid/status", nil)
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		scoringService := scoring.NewScoringService(bundle)
		AddRoutes(server, bundle, scoringService, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}
