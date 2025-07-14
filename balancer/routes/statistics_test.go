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
	"github.com/stretchr/testify/require"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestStatisticsHandler(t *testing.T) {
	createTeamWithSolvedChallenges := func(team string, challengesJSON string) *appsv1.Deployment {
		return &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges": challengesJSON,
				},
				Labels: map[string]string{"app.kubernetes.io/name": "juice-shop", "app.kubernetes.io/part-of": "multi-juicer", "team": team},
			},
			Status: appsv1.DeploymentStatus{ReadyReplicas: 1},
		}
	}

	// --- Test Data Setup ---
	// Challenge difficulties: scoreBoardChallenge=1 (10pts), nullByteChallenge=4 (40pts)
	challenge1Key := "scoreBoardChallenge"
	challenge2Key := "nullByteChallenge"

	// team-alpha: score 10
	teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challenge1Key, time.Now().Format(time.RFC3339))
	// team-bravo: score 50 (10 + 40)
	teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"},{"key":"%s","solvedAt":"%s"}]`,
		challenge1Key, time.Now().Format(time.RFC3339), challenge2Key, time.Now().Format(time.RFC3339))
	// team-charlie: score 40
	teamCharlieChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challenge2Key, time.Now().Format(time.RFC3339))

	clientset := fake.NewSimpleClientset(
		createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges),
		createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges),
		createTeamWithSolvedChallenges("team-charlie", teamCharlieChallenges),
	)

	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	// Add categories to the test challenges for category stats
	for i, ch := range bundle.JuiceShopChallenges {
		if ch.Key == challenge1Key {
			bundle.JuiceShopChallenges[i].Category = "Category A"
		}
		if ch.Key == challenge2Key {
			bundle.JuiceShopChallenges[i].Category = "Category B"
		}
	}

	scoringService := scoring.NewScoringService(bundle)
	err := scoringService.CalculateAndCacheScoreBoard(context.Background())
	require.NoError(t, err)

	server := http.NewServeMux()
	AddRoutes(server, bundle, scoringService)

	// --- Test Execution ---
	req, _ := http.NewRequest("GET", "/balancer/api/v2/statistics", nil)
	rr := httptest.NewRecorder()
	server.ServeHTTP(rr, req)

	// --- Assertions ---
	assert.Equal(t, http.StatusOK, rr.Code)

	var stats StatisticsResponse
	err = json.Unmarshal(rr.Body.Bytes(), &stats)
	require.NoError(t, err)

	// 1. Verify Category Stats
	require.Len(t, stats.CategoryStats, 2, "Should be two categories with solves")
	// Note: The order is not guaranteed, so we check for existence
	expectedCatA := CategoryStat{Category: "Category A", Solves: 2} // solved by alpha and bravo
	expectedCatB := CategoryStat{Category: "Category B", Solves: 2} // solved by bravo and charlie
	assert.Contains(t, stats.CategoryStats, expectedCatA)
	assert.Contains(t, stats.CategoryStats, expectedCatB)

	// 2. Verify Score Distribution
	// Scores are 10, 50, 40. Bucket size is 100.
	// Bucket "0-99" should contain all 3 teams.
	// All other buckets should contain 0.
	require.Len(t, stats.ScoreDistribution, 11, "The API should always return 11 score buckets")

	// Create a map for easy lookup
	bucketMap := make(map[string]int)
	for _, bucket := range stats.ScoreDistribution {
		bucketMap[bucket.Range] = bucket.Count
	}

	assert.Equal(t, 3, bucketMap["0-99"], "Bucket '0-99' should have 3 teams")
	assert.Equal(t, 0, bucketMap["100-199"], "Bucket '100-199' should be empty")
	assert.Equal(t, 0, bucketMap["200-299"], "Bucket '200-299' should be empty")
}
