package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes/fake"
	testcore "k8s.io/client-go/testing"
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
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService)

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
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"name":"foobar","score":-1,"position":-1,"solvedChallenges":0,"totalTeams":1,"readiness":false}`, rr.Body.String())
	})

	t.Run("returns ready when instance gets update by the scoring watcher", func(t *testing.T) {
		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(createTeamNumberOfReadyReplicas(team, `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1", 0))
		watcher := watch.NewFake()
		clientset.PrependWatchReactor("deployments", testcore.DefaultWatchReactor(watcher, nil))
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)
		scoringService.CalculateAndCacheScoreBoard(ctx)
		go scoringService.StartingScoringWorker(ctx)

		AddRoutes(server, bundle, scoringService)

		{
			req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
			rr := httptest.NewRecorder()
			req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
			server.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusOK, rr.Code)
			assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"solvedChallenges":1,"totalTeams":1,"readiness":false}`, rr.Body.String())
		}

		watcher.Modify(createTeamNumberOfReadyReplicas(team, `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1", 1))

		// the watcher might not have updated the readiness yet
		assert.Eventually(t, func() bool {
			req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
			rr := httptest.NewRecorder()
			req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
			server.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusOK, rr.Code)
			return assert.JSONEq(t, `{"name":"foobar","score":10,"position":1,"solvedChallenges":1,"totalTeams":1,"readiness":true}`, rr.Body.String())
		}, 1*time.Second, 10*time.Millisecond)
	})

	t.Run("returns a 401 if the balancer cookie isn't signed", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", team))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		scoringService := scoring.NewScoringService(bundle)
		AddRoutes(server, bundle, scoringService)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", strings.TrimSpace(rr.Body.String()))
	})

	t.Run("returns a a simplified response when the logged in team is the admin", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/teams/status", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		scoringService := scoring.NewScoringService(bundle)
		AddRoutes(server, bundle, scoringService)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `{"name":"admin"}`, rr.Body.String())
	})
}
