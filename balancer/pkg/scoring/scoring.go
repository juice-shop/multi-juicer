package scoring

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const updateInterval = 5 * time.Second

type TeamScore struct {
	Name       string   `json:"name"`
	Score      int      `json:"score"`
	Position   int      `json:"position"`
	Challenges []string `json:"challenges"`
}

// PersistedChallengeProgress is stored as a json array on the JuiceShop deployments, saving which challenges have been solved and when
type PersistedChallengeProgress struct {
	Key      string `json:"key"`
	SolvedAt string `json:"solvedAt"`
}

var cachedChallengesMap map[string](b.JuiceShopChallenge)

var (
	currentScores      = []TeamScore{}
	currentScoresMutex = &sync.Mutex{}
)

func GetScores() []TeamScore {
	return currentScores
}

// TrackScoresWorker is a worker that runs in the background and cheks the scores of all JuiceShop instances every 5 seconds
func StartingScoringWorker(bundle *b.Bundle) {
	// create a map of challenges for easy lookup by challenge key
	cachedChallengesMap = make(map[string](b.JuiceShopChallenge))
	for _, challenge := range bundle.JuiceShopChallenges {
		cachedChallengesMap[challenge.Key] = challenge
	}
	for {
		context := context.Background()
		time.Sleep(updateInterval)

		err := CalculateAndCacheScoreBoard(context, bundle, cachedChallengesMap)
		if err != nil {
			bundle.Log.Printf("Failed to calculate the score board. Claculation will be automatically retried in %ds : %v", updateInterval, err)
			continue
		}
	}
}

func CalculateAndCacheScoreBoard(context context.Context, bundle *b.Bundle, challengesMap map[string](b.JuiceShopChallenge)) error {
	teamScores, err := CalculateScoreBoard(context, bundle, challengesMap)
	if err != nil {
		return err
	}

	currentScoresMutex.Lock()
	defer currentScoresMutex.Unlock()
	currentScores = teamScores

	return nil
}

func CalculateScoreBoard(context context.Context, bundle *b.Bundle, challengesMap map[string](b.JuiceShopChallenge)) ([]TeamScore, error) {
	// Get all JuiceShop instances
	juiceShops, err := getDeployments(context, bundle)
	if err != nil {
		return nil, err
	}

	// Calculate the new scores
	teamScores := []TeamScore{}
	for _, juiceShop := range juiceShops.Items {
		teamScores = append(teamScores, calculateScore(bundle, &juiceShop, challengesMap))
	}

	sort.Slice(teamScores, func(i, j int) bool {
		return teamScores[i].Score > teamScores[j].Score
	})

	// set the position of each team, teams with the same score have the same position
	position := 1
	for i := 0; i < len(teamScores); i++ {
		if i > 0 && teamScores[i].Score < teamScores[i-1].Score {
			position = i + 1
		}
		teamScores[i].Position = position
	}
	return teamScores, nil
}

func getDeployments(context context.Context, bundle *b.Bundle) (*appsv1.DeploymentList, error) {
	deployments, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).List(context, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
	})
	if err != nil {
		return nil, err
	}
	return deployments, nil
}

func calculateScore(bundle *b.Bundle, teamDeployment *appsv1.Deployment, challengesMap map[string](b.JuiceShopChallenge)) TeamScore {
	solvedChallengesString := teamDeployment.Annotations["multi-juicer.owasp-juice.shop/challenges"]
	team := teamDeployment.Labels["team"]
	if solvedChallengesString == "" {
		return TeamScore{
			Name:       team,
			Score:      0,
			Challenges: []string{},
		}
	}

	solvedChallenges := []PersistedChallengeProgress{}
	err := json.Unmarshal([]byte(solvedChallengesString), &solvedChallenges)

	if err != nil {
		bundle.Log.Printf("JuiceShop deployment '%s' has an invalid 'multi-juicer.owasp-juice.shop/challenges' annotation. Assuming 0 solved challenges for it as the score can't be calculated.", team)
		return TeamScore{
			Name:       team,
			Score:      0,
			Challenges: []string{},
		}
	}

	score := 0
	solvedChallengeNames := []string{}
	for _, challengeSolved := range solvedChallenges {
		challenge, ok := challengesMap[challengeSolved.Key]
		if !ok {
			bundle.Log.Printf("JuiceShop deployment '%s' has a solved challenge '%s' that is not in the challenges map. The used JuiceShop version might be incompatible with this MultiJuicer version.", team, challengeSolved.Key)
			continue
		}
		score += challenge.Difficulty * 10
		solvedChallengeNames = append(solvedChallengeNames, challengeSolved.Key)
	}

	return TeamScore{
		Name:       team,
		Score:      score,
		Challenges: solvedChallengeNames,
	}
}
