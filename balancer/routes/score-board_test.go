package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func createTeam(team string, challenges string, solvedChallenges string) *appsv1.Deployment {
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

func TestScoreBoardHandler(t *testing.T) {
	t.Run("lists teams and calculates the score", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/score-board/top", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		bundle.JuiceShopChallenges = []b.JuiceShopChallenge{
			{
				Key:        "scoreBoardChallenge",
				Difficulty: 1,
			},
			{
				Key:        "nullByteChallenge",
				Difficulty: 4,
			},
		}
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ScoreBoardResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		assert.Equal(t, []TeamScore{
			{
				Name:       "foobar",
				Score:      50,
				Challenges: []string{"scoreBoardChallenge", "nullByteChallenge"},
			},
			{
				Name:       "barfoo",
				Score:      0,
				Challenges: []string{},
			},
		}, response.TopTeams)
	})

	t.Run("should only include the top 24 teams", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/score-board/top", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(
			createTeam("team-01", `[]`, "0"),
			createTeam("team-02", `[]`, "0"),
			createTeam("team-03", `[]`, "0"),
			createTeam("team-04", `[]`, "0"),
			createTeam("team-05", `[]`, "0"),
			createTeam("team-06", `[]`, "0"),
			createTeam("team-07", `[]`, "0"),
			createTeam("team-08", `[]`, "0"),
			createTeam("team-09", `[]`, "0"),
			createTeam("team-10", `[]`, "0"),
			createTeam("team-11", `[]`, "0"),
			createTeam("team-12", `[]`, "0"),
			createTeam("team-13", `[]`, "0"),
			createTeam("team-14", `[]`, "0"),
			createTeam("team-15", `[]`, "0"),
			createTeam("team-16", `[]`, "0"),
			createTeam("team-17", `[]`, "0"),
			createTeam("team-18", `[]`, "0"),
			createTeam("team-19", `[]`, "0"),
			createTeam("team-20", `[]`, "0"),
			createTeam("team-21", `[]`, "0"),
			createTeam("team-22", `[]`, "0"),
			createTeam("team-23", `[]`, "0"),
			createTeam("team-24", `[]`, "0"),
			createTeam("team-25", `[]`, "0"),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ScoreBoardResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		assert.Equal(t, 25, response.TotalTeams)
		assert.Equal(t, 24, len(response.TopTeams))
	})
}
