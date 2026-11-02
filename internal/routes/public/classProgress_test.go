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
	setupServer := func(classProgress b.ClassProgressConfig, teams ...runtime.Object) *http.ServeMux {
		bundle := testutil.NewTestBundleWithCustomFakeClient(fake.NewClientset(teams...))
		bundle.JuiceShopChallenges = append(bundle.JuiceShopChallenges,
			b.JuiceShopChallenge{Key: "loginAdminChallenge", Name: "Login Admin", Difficulty: 2},
			b.JuiceShopChallenge{Key: "localXssChallenge", Name: "DOM XSS", Difficulty: 1},
			b.JuiceShopChallenge{Key: "loginJimChallenge", Name: "Login Jim", Difficulty: 3},
		)
		bundle.Config.ClassProgress = classProgress
		scoringService := scoring.NewScoringService(bundle)
		scoringService.CalculateAndCacheScoreBoard(context.Background())
		bundle.ScoringService = scoringService

		server := http.NewServeMux()
		AddRoutes(server, bundle)
		return server
	}
	classProgress := b.ClassProgressConfig{
		Mandatory: []string{"scoreBoardChallenge", "loginAdminChallenge", "localXssChallenge"},
		Suggested: []string{"loginJimChallenge", "nullByteChallenge"},
	}

	t.Run("returns 404 when no class progress is configured", func(t *testing.T) {
		server := setupServer(b.ClassProgressConfig{})
		req, _ := http.NewRequest("GET", "/multi-juicer/api/class-progress", nil)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})

	t.Run("reports the progress of each team on the configured challenges", func(t *testing.T) {
		server := setupServer(classProgress,
			createTeamWithSolvedChallenges("beginners", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48Z"}]`),
			createTeamWithSolvedChallenges("finished", `[{"key":"localXssChallenge","solvedAt":"2024-11-01T19:50:00Z"},{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:40:00Z"},{"key":"loginAdminChallenge","solvedAt":"2024-11-01T19:45:00Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T20:00:00Z"}]`),
			createTeamWithSolvedChallenges("newcomers", `[]`),
		)
		req, _ := http.NewRequest("GET", "/multi-juicer/api/class-progress", nil)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		var response ClassProgressResponse
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &response))

		assert.Equal(t, []ClassProgressChallenge{
			{Key: "scoreBoardChallenge", Name: "Score Board", SolveCount: 2},
			{Key: "loginAdminChallenge", Name: "Login Admin", SolveCount: 1},
			{Key: "localXssChallenge", Name: "DOM XSS", SolveCount: 1},
		}, response.Mandatory)
		assert.Equal(t, []ClassProgressChallenge{
			{Key: "loginJimChallenge", Name: "Login Jim", SolveCount: 0},
			{Key: "nullByteChallenge", Name: "Poison Null Byte", SolveCount: 1},
		}, response.Suggested)
		assert.Equal(t, []ClassProgressTeam{
			{
				Name:             "finished",
				MandatorySolved:  3,
				SuggestedSolved:  1,
				SolvedChallenges: []string{"scoreBoardChallenge", "loginAdminChallenge", "localXssChallenge", "nullByteChallenge"},
			},
			{
				Name:             "beginners",
				MandatorySolved:  1,
				SuggestedSolved:  0,
				SolvedChallenges: []string{"scoreBoardChallenge"},
			},
			{
				Name:             "newcomers",
				MandatorySolved:  0,
				SuggestedSolved:  0,
				SolvedChallenges: []string{},
			},
		}, response.Teams)
	})

	t.Run("ignores solved challenges which are not on the lists", func(t *testing.T) {
		server := setupServer(b.ClassProgressConfig{Mandatory: []string{"scoreBoardChallenge"}},
			createTeamWithSolvedChallenges("team1", `[{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48Z"}]`),
		)
		req, _ := http.NewRequest("GET", "/multi-juicer/api/class-progress", nil)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		var response ClassProgressResponse
		require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &response))
		assert.Equal(t, []ClassProgressChallenge{}, response.Suggested)
		assert.Equal(t, []ClassProgressTeam{
			{
				Name:             "team1",
				SolvedChallenges: []string{},
			},
		}, response.Teams)
	})

	t.Run("long-polling times out when no updates occur", func(t *testing.T) {
		server := setupServer(classProgress, createTeamWithSolvedChallenges("team1", `[]`))
		req, _ := http.NewRequest("GET", "/multi-juicer/api/class-progress?wait-for-update-after=2099-01-01T00:00:00Z", nil)
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		req = req.WithContext(ctx)
		rr := httptest.NewRecorder()

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)
	})
}
