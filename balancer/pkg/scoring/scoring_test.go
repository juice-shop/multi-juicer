package scoring

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes/fake"
	testcore "k8s.io/client-go/testing"
)

func TestScoreingService(t *testing.T) {
	createTeamWithInstanceReadiness := func(team string, challenges string, solvedChallenges string, instanceReadiness bool) *appsv1.Deployment {
		var replicas int32 = 1
		if !instanceReadiness {
			replicas = 0
		}
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
				ReadyReplicas: replicas,
			},
		}
	}
	createTeam := func(team string, challenges string, solvedChallenges string) *appsv1.Deployment {
		return createTeamWithInstanceReadiness(team, challenges, solvedChallenges, true)
	}

	novemberFirst := time.Date(2024, 11, 1, 19, 55, 48, 211000000, time.UTC)
	t.Run("correctly calculates team scores", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)

		scoringService := NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		assert.Nil(t, err)

		scores := scoringService.GetTopScores()

		assert.Nil(t, err)
		assert.Equal(t, []*TeamScore{
			{
				Name:     "foobar",
				Score:    50,
				Position: 1,
				Challenges: []ChallengeProgress{
					{
						Key:      "scoreBoardChallenge",
						SolvedAt: novemberFirst,
					},
					{
						Key:      "nullByteChallenge",
						SolvedAt: novemberFirst,
					},
				},
				InstanceReadiness: true,
			},
			{
				Name:              "barfoo",
				Score:             0,
				Position:          2,
				Challenges:        []ChallengeProgress{},
				InstanceReadiness: true,
			},
		}, scores)
	})

	t.Run("teams with the same score get the same position assigned", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo-1", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
			createTeam("barfoo-2", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
			createTeam("last", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)

		scoringService := NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		assert.Nil(t, err)

		scores := scoringService.GetTopScores()

		assert.Nil(t, err)
		assert.Equal(t, []*TeamScore{
			{
				Name:     "foobar",
				Score:    50,
				Position: 1,
				Challenges: []ChallengeProgress{
					{
						Key:      "scoreBoardChallenge",
						SolvedAt: novemberFirst,
					},
					{
						Key:      "nullByteChallenge",
						SolvedAt: novemberFirst,
					},
				},
				InstanceReadiness: true,
			},
			{
				Name:     "barfoo-1",
				Score:    10,
				Position: 2,
				Challenges: []ChallengeProgress{
					{
						Key:      "scoreBoardChallenge",
						SolvedAt: novemberFirst,
					},
				},
				InstanceReadiness: true,
			},
			{
				Name:     "barfoo-2",
				Score:    10,
				Position: 2,
				Challenges: []ChallengeProgress{
					{
						Key:      "scoreBoardChallenge",
						SolvedAt: novemberFirst,
					},
				},
				InstanceReadiness: true,
			},
			{
				Name:              "last",
				Score:             0,
				Position:          4, // should be 4 not 3 as there are two teams with the same score on position 2
				Challenges:        []ChallengeProgress{},
				InstanceReadiness: true,
			},
		}, scores)
	})

	t.Run("calculates score for known challenges only and skip unknown challenges", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"unkown-challenge-key","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)

		scoringService := NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		assert.Nil(t, err)

		scores := scoringService.GetTopScores()

		assert.Nil(t, err)
		assert.Equal(t, []*TeamScore{
			{
				Name:     "foobar",
				Score:    40,
				Position: 1,
				Challenges: []ChallengeProgress{
					{
						Key:      "nullByteChallenge",
						SolvedAt: novemberFirst,
					},
				},
				InstanceReadiness: true,
			},
			{
				Name:              "barfoo",
				Score:             0,
				Position:          2,
				Challenges:        []ChallengeProgress{},
				InstanceReadiness: true,
			},
		}, scores)
	})

	t.Run("properly sets readiness", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(
			createTeamWithInstanceReadiness("foobar", `[]`, "0", false),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)

		scoringService := NewScoringService(bundle)
		err := scoringService.CalculateAndCacheScoreBoard(context.Background())
		assert.Nil(t, err)

		scores := scoringService.GetTopScores()

		assert.Nil(t, err)
		assert.Equal(t, []*TeamScore{
			{
				Name:              "foobar",
				Score:             0,
				Position:          1,
				Challenges:        []ChallengeProgress{},
				InstanceReadiness: false,
			},
		}, scores)
	})

	t.Run("watcher properly updates scores", func(t *testing.T) {
		clientset := fake.NewClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "1"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		scoringService := NewScoringService(bundle)

		ctx, cancel := context.WithCancel(context.Background())
		t.Cleanup(cancel)

		err := scoringService.CalculateAndCacheScoreBoard(ctx)
		assert.Nil(t, err)
		go scoringService.StartingScoringWorker(ctx)
		assert.Equal(t, 10, scoringService.GetScores()["foobar"].Score)

		watcher := watch.NewFake()
		clientset.PrependWatchReactor("deployments", testcore.DefaultWatchReactor(watcher, nil))
		watcher.Modify(createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"))

		assert.Eventually(t, func() bool {
			return scoringService.GetScores()["foobar"].Score == 50
		}, 1*time.Second, 10*time.Millisecond)
	})
}

func TestScoreingSorting(t *testing.T) {
	createTeamScore := func(team string, score int, challenges ...ChallengeProgress) *TeamScore {
		return &TeamScore{
			Name:       team,
			Score:      score,
			Challenges: challenges,
		}
	}

	now := time.Now()

	t.Run("sorts score in this order: score -> 'time to reach score' -> team name", func(t *testing.T) {
		scores := map[string]*TeamScore{
			"0-last-place": createTeamScore("0-last-place", 0),
			// last place is shared by two teams with the same score and same time to reach the score, they should be sorted by team name for consistency.
			"1-actual-last-place": createTeamScore("1-second-last-place", 0),
			"0-winning-team": createTeamScore("0-winning-team", 100,
				ChallengeProgress{Key: "scoreBoardChallenge", SolvedAt: now},
				ChallengeProgress{Key: "nullByteChallenge", SolvedAt: now},
				ChallengeProgress{Key: "anotherChallenge", SolvedAt: now},
			),
			"1-second-place": createTeamScore("1-second-place", 50,
				ChallengeProgress{Key: "scoreBoardChallenge", SolvedAt: now.Add(-10 * time.Second)},
				ChallengeProgress{Key: "nullByteChallenge", SolvedAt: now.Add(-30 * time.Second)},
			),
			// same score as 1-second-place but it solved the challenges later, so it should be placed after 1-second-place
			"0-second-place": createTeamScore("0-second-place", 50,
				ChallengeProgress{Key: "scoreBoardChallenge", SolvedAt: now},
				ChallengeProgress{Key: "nullByteChallenge", SolvedAt: now},
			),
			// forth place is shared by two teams with the same score and same time to reach the score, they should be sorted by team name for consistency.
			// the likelyhood of two teams having the same score and solving the challenges at the same time is nearly zero so we ignore the unfairness of sorting by team name
			// there is no 3rd place because 1-second-place and 0-second-place share the same position
			"1-forth-place": createTeamScore("1-forth-place", 40,
				ChallengeProgress{Key: "nullByteChallenge", SolvedAt: now},
			),
			"0-forth-place": createTeamScore("0-forth-place", 40,
				ChallengeProgress{Key: "nullByteChallenge", SolvedAt: now},
			),
		}

		sortedTeams := sortTeamsByScoreAndCalculatePositions(scores)

		type TeamNameWithPosition struct {
			Name     string
			Position int
		}

		sortedTeamWithPositions := make([]TeamNameWithPosition, len(sortedTeams))
		for i, team := range sortedTeams {
			sortedTeamWithPositions[i] = TeamNameWithPosition{
				Name:     team.Name,
				Position: team.Position,
			}
		}

		assert.Equal(t, []TeamNameWithPosition{
			{Name: "0-winning-team", Position: 1},
			{Name: "1-second-place", Position: 2},
			{Name: "0-second-place", Position: 2},
			{Name: "0-forth-place", Position: 4},
			{Name: "1-forth-place", Position: 4},
			{Name: "0-last-place", Position: 6},
			{Name: "1-second-last-place", Position: 6},
		}, sortedTeamWithPositions)
	})
}
