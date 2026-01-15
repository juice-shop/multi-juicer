package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAdminListInstanceshandler(t *testing.T) {
	var createTeamWithCheatScores func(team string, createdAt time.Time, lastRequest time.Time, readyReplicas int32, cheatScores string) *appsv1.Deployment

	createTeam := func(team string, createdAt time.Time, lastRequest time.Time, readyReplicas int32) *appsv1.Deployment {
		return createTeamWithCheatScores(team, createdAt, lastRequest, readyReplicas, "")
	}

	createTeamWithCheatScores = func(team string, createdAt time.Time, lastRequest time.Time, readyReplicas int32, cheatScores string) *appsv1.Deployment {
		annotations := map[string]string{
			"multi-juicer.owasp-juice.shop/challenges":          "[]",
			"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
			"multi-juicer.owasp-juice.shop/lastRequest":         fmt.Sprintf("%d", lastRequest.UnixMilli()),
			"multi-juicer.owasp-juice.shop/lastRequestReadable": "2024-10-18 13:55:18.08198884+0000 UTC m=+11.556786174",
			"multi-juicer.owasp-juice.shop/passcode":            "$2a$10$wnxvqClPk/13SbdowdJtu.2thGxrZe4qrsaVdTVUsYIrVVClhPMfS",
		}
		if cheatScores != "" {
			annotations["multi-juicer.owasp-juice.shop/cheatScores"] = cheatScores
		}

		return &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				CreationTimestamp: metav1.Time{
					Time: createdAt,
				},
				Annotations: annotations,
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

	t.Run("listing instances requires admin login", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/all", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("some team")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle, nil)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "\n", rr.Body.String())
	})

	t.Run("lists all juice shop instances", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/all", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(
			createTeam("foobar", time.UnixMilli(1_700_000_000_000), time.UnixMilli(1_729_259_666_123), 1),
			createTeam("test-team", time.UnixMilli(1_600_000_000_000), time.UnixMilli(1_729_259_333_123), 0),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle, nil)

		server.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)

		var response AdminListInstancesResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		assert.Equal(t, []AdminListJuiceShopInstance{
			{
				Team:        "foobar",
				Ready:       true,
				CreatedAt:   1_700_000_000_000,
				LastConnect: 1_729_259_666_123,
				CheatScore:        nil,
				CheatScoreHistory: nil,
			},
			{
				Team:        "test-team",
				Ready:       false,
				CreatedAt:   1_600_000_000_000,
				LastConnect: 1_729_259_333_123,
				CheatScore:        nil,
				CheatScoreHistory: nil,
			},
		}, response.Instances)
	})

	t.Run("includes cheat scores when available", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/all", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		// Create teams with cheat score histories
		cheatScores1 := `[{"totalCheatScore":0.25,"timestamp":"2024-10-18T13:55:18Z"},{"totalCheatScore":0.42,"timestamp":"2024-10-18T14:30:22Z"}]`
		cheatScores2 := `[{"totalCheatScore":0.15,"timestamp":"2024-10-18T13:50:10Z"}]`

		clientset := fake.NewClientset(
			createTeamWithCheatScores("team-with-scores", time.UnixMilli(1_700_000_000_000), time.UnixMilli(1_729_259_666_123), 1, cheatScores1),
			createTeamWithCheatScores("another-team", time.UnixMilli(1_600_000_000_000), time.UnixMilli(1_729_259_333_123), 1, cheatScores2),
			createTeam("team-without-scores", time.UnixMilli(1_650_000_000_000), time.UnixMilli(1_729_259_555_123), 0),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle, nil)

		server.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)

		var response AdminListInstancesResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		// Find teams in response
		var teamWithScores, anotherTeam, teamWithoutScores *AdminListJuiceShopInstance
		for i := range response.Instances {
			switch response.Instances[i].Team {
			case "team-with-scores":
				teamWithScores = &response.Instances[i]
			case "another-team":
				anotherTeam = &response.Instances[i]
			case "team-without-scores":
				teamWithoutScores = &response.Instances[i]
			}
		}

		// Verify team with multiple cheat scores returns the newest one (0.42)
		assert.NotNil(t, teamWithScores)
		assert.NotNil(t, teamWithScores.CheatScore)
		assert.InDelta(t, 0.42, *teamWithScores.CheatScore, 0.001)
		assert.Len(t, teamWithScores.CheatScoreHistory, 2)
		assert.Equal(t, 0.25, teamWithScores.CheatScoreHistory[0].TotalCheatScore)
		assert.Equal(t, 0.42, teamWithScores.CheatScoreHistory[1].TotalCheatScore)

		// Verify team with single cheat score returns it (0.15)
		assert.NotNil(t, anotherTeam)
		assert.NotNil(t, anotherTeam.CheatScore)
		assert.InDelta(t, 0.15, *anotherTeam.CheatScore, 0.001)
		assert.Len(t, anotherTeam.CheatScoreHistory, 1)

		// Verify team without cheat scores has nil
		assert.NotNil(t, teamWithoutScores)
		assert.Nil(t, teamWithoutScores.CheatScore)
	})

	t.Run("handles invalid cheat score JSON gracefully", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/all", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		// Create team with invalid cheat scores JSON
		invalidCheatScores := `{invalid json`

		clientset := fake.NewClientset(
			createTeamWithCheatScores("team-invalid-json", time.UnixMilli(1_700_000_000_000), time.UnixMilli(1_729_259_666_123), 1, invalidCheatScores),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle, nil)

		server.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)

		var response AdminListInstancesResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		// Should return the team with nil cheat score when JSON is invalid
		assert.Len(t, response.Instances, 1)
		assert.Equal(t, "team-invalid-json", response.Instances[0].Team)
		assert.Nil(t, response.Instances[0].CheatScore)
	})

	t.Run("handles empty cheat scores array", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/all", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		// Create team with empty cheat scores array
		emptyCheatScores := `[]`

		clientset := fake.NewClientset(
			createTeamWithCheatScores("team-empty-scores", time.UnixMilli(1_700_000_000_000), time.UnixMilli(1_729_259_666_123), 1, emptyCheatScores),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle, nil)

		server.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)

		var response AdminListInstancesResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		// Should return the team with nil cheat score when array is empty
		assert.Len(t, response.Instances, 1)
		assert.Equal(t, "team-empty-scores", response.Instances[0].Team)
		assert.Nil(t, response.Instances[0].CheatScore)
	})
}
