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
	"k8s.io/client-go/kubernetes/fake"
)

func TestScoreProgressionHandler(t *testing.T) {
	challenge1Key := "scoreBoardChallenge" // 10 pts
	challenge2Key := "nullByteChallenge"   // 40 pts

	time1 := time.Now().Add(-20 * time.Minute) // team-alpha solves C1
	time2 := time.Now().Add(-10 * time.Minute) // team-bravo solves C2

	teamAlphaChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challenge1Key, time1.Format(time.RFC3339))
	teamBravoChallenges := fmt.Sprintf(`[{"key":"%s","solvedAt":"%s"}]`, challenge2Key, time2.Format(time.RFC3339))

	clientset := fake.NewSimpleClientset(
		createTeamWithSolvedChallenges("team-alpha", teamAlphaChallenges), // 10 pts
		createTeamWithSolvedChallenges("team-bravo", teamBravoChallenges), // 40 pts
	)

	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	scoringService := scoring.NewScoringService(bundle)
	scoringService.CalculateAndCacheScoreBoard(context.Background())
	server := http.NewServeMux()
	AddRoutes(server, bundle, scoringService)

	req, _ := http.NewRequest("GET", "/balancer/api/v2/statistics/score-progression", nil)
	rr := httptest.NewRecorder()
	server.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)
	var response []TeamSeries
	err := json.Unmarshal(rr.Body.Bytes(), &response)
	require.NoError(t, err)

	require.Len(t, response, 2, "Should have a data series for each of the two teams")

	// Create maps for easy lookup
	seriesMap := make(map[string]TeamSeries)
	for _, s := range response {
		seriesMap[s.Team] = s
	}

	alphaSeries := seriesMap["team-alpha"]
	bravoSeries := seriesMap["team-bravo"]

	// Verify the data points for team-alpha (score becomes 10 at time1)
	require.Len(t, alphaSeries.DataPoints, 3)
	assert.Equal(t, 0, alphaSeries.DataPoints[0].Score)  // Starts at 0
	assert.Equal(t, 10, alphaSeries.DataPoints[1].Score) // Score becomes 10
	assert.Equal(t, 10, alphaSeries.DataPoints[2].Score) // Score stays 10 at time2

	// Verify the data points for team-bravo (score becomes 40 at time2)
	require.Len(t, bravoSeries.DataPoints, 3)
	assert.Equal(t, 0, bravoSeries.DataPoints[0].Score)  // Starts at 0
	assert.Equal(t, 0, bravoSeries.DataPoints[1].Score)  // Score is still 0 at time1
	assert.Equal(t, 40, bravoSeries.DataPoints[2].Score) // Score becomes 40
}
