package public

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	b "github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/scoring"
	"github.com/juice-shop/multi-juicer/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
)

func TestClassProgressHandler(t *testing.T) {
	setupServer := func(groups []b.ChallengeGroup, teams ...runtime.Object) *http.ServeMux {
		bundle := testutil.NewTestBundleWithCustomFakeClient(fake.NewClientset(teams...))
		bundle.JuiceShopChallenges = append(bundle.JuiceShopChallenges,
			b.JuiceShopChallenge{Key: "loginAdminChallenge", Name: "Login Admin", Difficulty: 2},
			b.JuiceShopChallenge{Key: "localXssChallenge", Name: "DOM XSS", Difficulty: 1},
			b.JuiceShopChallenge{Key: "loginJimChallenge", Name: "Login Jim", Difficulty: 3},
		)
		bundle.Config.Views.ClassProgress = b.ClassProgressViewConfig{Enabled: true, Groups: groups}
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		bundle.ScoringService = scoringService

		server := http.NewServeMux()
		AddRoutes(server, bundle)
		return server
	}
	groups := []b.ChallengeGroup{
		{Name: "Week 1", Challenges: []string{"scoreBoardChallenge", "loginAdminChallenge"}},
		{Name: "Week 2", Challenges: []string{"localXssChallenge", "loginJimChallenge"}},
	}

	t.Run("lists the solved challenges of each team which are part of a group", func(t *testing.T) {
		server := setupServer(groups,
			createTeamWithSolvedChallenges("beginners", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48Z"}]`),
			createTeamWithSolvedChallenges("finished", `[{"key":"nullByteChallenge","solvedAt":"2024-11-01T20:00:00Z"},{"key":"loginJimChallenge","solvedAt":"2024-11-01T19:55:00Z"},{"key":"localXssChallenge","solvedAt":"2024-11-01T19:50:00Z"},{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:40:00Z"},{"key":"loginAdminChallenge","solvedAt":"2024-11-01T19:45:00Z"}]`),
			createTeamWithSolvedChallenges("newcomers", `[]`),
		)
		req, _ := http.NewRequest("GET", "/multi-juicer/api/class-progress", nil)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		var response ClassProgressResponse
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &response))
		assert.Equal(t, []ClassProgressTeam{
			{Name: "finished", SolvedChallenges: []string{"scoreBoardChallenge", "loginAdminChallenge", "localXssChallenge", "loginJimChallenge"}},
			{Name: "beginners", SolvedChallenges: []string{"scoreBoardChallenge"}},
			{Name: "newcomers", SolvedChallenges: []string{}},
		}, response.Teams)
	})

	t.Run("long-polling times out when no updates occur", func(t *testing.T) {
		server := setupServer(groups, createTeamWithSolvedChallenges("team1", `[]`))
		req, _ := http.NewRequest("GET", "/multi-juicer/api/class-progress?wait-for-update-after=2099-01-01T00:00:00Z", nil)
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		req = req.WithContext(ctx)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)
	})
}
