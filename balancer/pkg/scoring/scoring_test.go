package scoring

import (
	"context"
	"fmt"
	"testing"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
	t.Run("correctly calculates team scores", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)

		scores, err := CalculateScoreBoard(context.Background(), bundle, map[string]b.JuiceShopChallenge{
			"scoreBoardChallenge": {
				Key:        "scoreBoardChallenge",
				Difficulty: 1,
			},
			"nullByteChallenge": {
				Key:        "nullByteChallenge",
				Difficulty: 4,
			},
		})

		assert.Nil(t, err)
		assert.Equal(t, []TeamScore{
			{
				Name:       "foobar",
				Score:      50,
				Position:   1,
				Challenges: []string{"scoreBoardChallenge", "nullByteChallenge"},
			},
			{
				Name:       "barfoo",
				Score:      0,
				Position:   2,
				Challenges: []string{},
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

		scores, err := CalculateScoreBoard(context.Background(), bundle, map[string]b.JuiceShopChallenge{
			"scoreBoardChallenge": {
				Key:        "scoreBoardChallenge",
				Difficulty: 1,
			},
			"nullByteChallenge": {
				Key:        "nullByteChallenge",
				Difficulty: 4,
			},
		})

		assert.Nil(t, err)
		assert.Equal(t, []TeamScore{
			{
				Name:       "foobar",
				Score:      50,
				Position:   1,
				Challenges: []string{"scoreBoardChallenge", "nullByteChallenge"},
			},
			{
				Name:       "barfoo-1",
				Score:      10,
				Position:   2,
				Challenges: []string{"scoreBoardChallenge"},
			},
			{
				Name:       "barfoo-2",
				Score:      10,
				Position:   2,
				Challenges: []string{"scoreBoardChallenge"},
			},
			{
				Name:       "last",
				Score:      0,
				Position:   4, // should be 4 not 3 as there are two teams with the same score on position 2
				Challenges: []string{},
			},
		}, scores)
	})

	t.Run("calculates score for known challenges only and skip unknown challenges", func(t *testing.T) {
		clientset := fake.NewSimpleClientset(
			createTeam("foobar", `[{"key":"scoreBoardChallenge","solvedAt":"2024-11-01T19:55:48.211Z"},{"key":"nullByteChallenge","solvedAt":"2024-11-01T19:55:48.211Z"}]`, "2"),
			createTeam("barfoo", `[]`, "0"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)

		scores, err := CalculateScoreBoard(context.Background(), bundle, map[string]b.JuiceShopChallenge{
			"nullByteChallenge": {
				Key:        "nullByteChallenge",
				Difficulty: 4,
			},
		})

		assert.Nil(t, err)
		assert.Equal(t, []TeamScore{
			{
				Name:       "foobar",
				Score:      40,
				Position:   1,
				Challenges: []string{"nullByteChallenge"},
			},
			{
				Name:       "barfoo",
				Score:      0,
				Position:   2,
				Challenges: []string{},
			},
		}, scores)
	})
}
