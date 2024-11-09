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
		req, _ := http.NewRequest("GET", "/balancer/api/score-board/top", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		var teams []runtime.Object
		for i := 1; i <= 25; i++ {
			teamName := fmt.Sprintf("team-%02d", i)
			teams = append(teams, createTeam(teamName, `[]`, "0"))
		}
		clientset := fake.NewSimpleClientset(teams...)

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

	t.Run("calculates score for known challenges only and skip unknown challenges", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/score-board/top", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"thisChallengeDoesNotAcutallyExistButIsOnlyForMultiJuicerTests","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		bundle.JuiceShopChallenges = []b.JuiceShopChallenge{
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
				Score:      40,
				Challenges: []string{"nullByteChallenge"},
			},
			{
				Name:       "barfoo",
				Score:      0,
				Challenges: []string{},
			},
		}, response.TopTeams)
	})
}
