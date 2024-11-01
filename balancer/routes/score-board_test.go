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

func TestScoreBoardHandler(t *testing.T) {
	team := "foobar"
	team2 := "barfoo"

	t.Run("lists teams and calculates the score", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/score-board/top", nil)
		req.Header.Set("Cookie", fmt.Sprintf("balancer=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewSimpleClientset(&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":       `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`,
					"multi-juicer.owasp-juice.shop/challengesSolved": "2",
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
		}, &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team2),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":       `[]`,
					"multi-juicer.owasp-juice.shop/challengesSolved": "0",
				},
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
					"team":                      team2,
				},
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas: 1,
			},
		})
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
				Name:       team,
				Score:      50,
				Challenges: []string{"scoreBoardChallenge", "nullByteChallenge"},
			},
			{
				Name:       team2,
				Score:      0,
				Challenges: []string{},
			},
		}, response.TopTeams)
	})
}
