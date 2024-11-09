package routes

import (
	"context"
	"encoding/json"
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
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestScoreBoardHandler(t *testing.T) {
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
	t.Run("lists teams and calculates the score", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/score-board/top", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoring.CalculateAndCacheScoreBoard(context.Background(), bundle, map[string]b.JuiceShopChallenge{
			"scoreBoardChallenge": {
				Key:        "scoreBoardChallenge",
				Difficulty: 1,
			},
			"nullByteChallenge": {
				Key:        "nullByteChallenge",
				Difficulty: 4,
			},
		})
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ScoreBoardResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		foo := scoring.GetScores()
		_ = foo

		assert.Equal(t, []scoring.TeamScore{
			{
				Name:       "foobar",
				Score:      50,
				Position:   1,
				Challenges: []string{"scoreBoardChallenge", "nullByteChallenge"},
			},
			{
				Name:       "barfoo",
				Score:      0,
				Position:   2,
				Challenges: []string{},
			},
		}, response.TopTeams)
	})

	t.Run("should only include the top 24 teams", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/score-board/top", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		var teams []runtime.Object
		for i := 1; i <= 25; i++ {
			teamName := fmt.Sprintf("team-%02d", i)
			teams = append(teams, createTeam(teamName, `[]`, "0"))
		}
		teams = append(teams, createTeam("winning-team", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"))
		clientset := fake.NewSimpleClientset(teams...)
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

		var response ScoreBoardResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		assert.Equal(t, 26, response.TotalTeams)
		assert.Equal(t, 24, len(response.TopTeams))

		// winning-team should be the first team in the list
		assert.Equal(t, "winning-team", response.TopTeams[0].Name)
		assert.Equal(t, 1, response.TopTeams[0].Position)

		// team-24 should be the last team in the list
		assert.Equal(t, "team-24", response.TopTeams[23].Name)
		// team-24 should still be in the 2 "positions" because it has the same score as the other duplicated teams before it
		assert.Equal(t, 2, response.TopTeams[23].Position)
	})
}
