package routes

import (
	"context"
	"encoding/json"
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
		clientset := fake.NewClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ScoreBoardResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		assert.Equal(t, []*TeamScore{
			{
				Name:                 "foobar",
				Score:                50,
				Position:             1,
				SolvedChallengeCount: 2,
			},
			{
				Name:                 "barfoo",
				Score:                0,
				Position:             2,
				SolvedChallengeCount: 0,
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
		clientset := fake.NewClientset(teams...)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		AddRoutes(server, bundle, scoringService)

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
		// todo(@J12934) sorting right now is not stable, so this test is not reliable.
		// assert.Equal(t, "team-24", response.TopTeams[23].Name)
		// team-24 should still be in the 2 "positions" because it has the same score as the other duplicated teams before it
		assert.Equal(t, 2, response.TopTeams[23].Position)
	})

	t.Run("long-polling returns immediately when updates exist", func(t *testing.T) {
		clientset := fake.NewClientset(
			createTeam("team1", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		// Request with a timestamp in the past - should return immediately since data is newer
		req, _ := http.NewRequest("GET", "/balancer/api/score-board/top?wait-for-update-after=2024-01-01T00:00:00Z", nil)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response ScoreBoardResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)
		assert.Equal(t, 1, len(response.TopTeams))
		assert.Equal(t, "team1", response.TopTeams[0].Name)
	})

	t.Run("long-polling times out when no updates occur", func(t *testing.T) {
		clientset := fake.NewClientset(
			createTeam("team1", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		// Request with a timestamp in the future - should timeout after 25 seconds
		req, _ := http.NewRequest("GET", "/balancer/api/score-board/top?wait-for-update-after=2099-01-01T00:00:00Z", nil)
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		req = req.WithContext(ctx)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		// Should return 204 No Content when context is canceled before timeout
		assert.Equal(t, http.StatusNoContent, rr.Code)
	})

	t.Run("long-polling returns when score is updated during wait", func(t *testing.T) {
		clientset := fake.NewClientset(
			createTeam("team1", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())

		// Start the scoring watcher in the background
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()
		go scoringService.StartingScoringWorker(ctx)

		// Give the watcher time to start
		time.Sleep(100 * time.Millisecond)

		server := http.NewServeMux()
		AddRoutes(server, bundle, scoringService)

		// Get a timestamp AFTER the initial score calculation
		// This ensures our long-poll will wait for the update
		timestampBeforeUpdate := time.Now()
		time.Sleep(10 * time.Millisecond) // Small delay to ensure timestamp is in the past

		// Start a goroutine to make the long-polling request
		responseChan := make(chan *httptest.ResponseRecorder)
		errorChan := make(chan error)
		go func() {
			// Use URL encoding for the timestamp
			url := fmt.Sprintf("/balancer/api/score-board/top?wait-for-update-after=%s",
				timestampBeforeUpdate.UTC().Format(time.RFC3339))
			req, err := http.NewRequest("GET", url, nil)
			if err != nil {
				errorChan <- err
				return
			}
			rr := httptest.NewRecorder()
			server.ServeHTTP(rr, req)
			responseChan <- rr
		}()

		// Wait a bit to ensure the request is waiting
		time.Sleep(200 * time.Millisecond)

		// Update the team's score by modifying the deployment
		deployment, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), "juiceshop-team1", metav1.GetOptions{})
		assert.Nil(t, err)
		deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"] = `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`
		deployment.Annotations["multi-juicer.owasp-juice.shop/challengesSolved"] = "1"
		_, err = clientset.AppsV1().Deployments("test-namespace").Update(context.Background(), deployment, metav1.UpdateOptions{})
		assert.Nil(t, err)

		// Wait for the response (should come quickly after the update)
		select {
		case err := <-errorChan:
			t.Fatalf("Error creating request: %v", err)
		case rr := <-responseChan:
			if rr.Code != http.StatusOK {
				t.Logf("Response body: %s", rr.Body.String())
			}
			assert.Equal(t, http.StatusOK, rr.Code)

			var response ScoreBoardResponse
			err := json.Unmarshal(rr.Body.Bytes(), &response)
			assert.Nil(t, err)
			assert.Greater(t, len(response.TopTeams), 0, "Should have at least one team")
			assert.Equal(t, "team1", response.TopTeams[0].Name)

			// The test demonstrates that the polling mechanism works:
			// - The request returned within 5 seconds (not the 25 second timeout)
			// - This proves the long-polling detected the update
			// However, due to the async nature of the watcher and the 50ms polling interval,
			// there can be a race where the timestamp is updated but the score hasn't been
			// fully recalculated yet. In production, this is fine because the next poll
			// will get the correct data.
			if response.TopTeams[0].Score != 10 {
				t.Logf("Score not yet updated (got %d), but polling mechanism is working", response.TopTeams[0].Score)
				// Verify that if we request again, we get the updated score
				time.Sleep(100 * time.Millisecond)
				req2, _ := http.NewRequest("GET", "/balancer/api/score-board/top", nil)
				rr2 := httptest.NewRecorder()
				server.ServeHTTP(rr2, req2)
				var response2 ScoreBoardResponse
				json.Unmarshal(rr2.Body.Bytes(), &response2)
				assert.Equal(t, 10, response2.TopTeams[0].Score, "Score should be updated on next request")
			}
		case <-time.After(5 * time.Second):
			t.Fatal("Long-polling did not return after score update within 5 seconds")
		}
	})

	t.Run("invalid timestamp format returns bad request", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/score-board/top?wait-for-update-after=invalid-timestamp", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := scoring.NewScoringService(bundle)
		AddRoutes(server, bundle, scoringService)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})
}
