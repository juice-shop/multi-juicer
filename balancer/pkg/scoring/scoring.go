package scoring

import (
	"context"
	"encoding/json"
	"reflect"
	"sort"
	"sync"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
)

type TeamScore struct {
	Name       string              `json:"name"`
	Score      int                 `json:"score"`
	Position   int                 `json:"position"`
	Challenges []ChallengeProgress `json:"challenges"`
}

// PersistedChallengeProgress is stored as a json array on the JuiceShop deployments, saving which challenges have been solved and when
type ChallengeProgress struct {
	Key      string    `json:"key"`
	SolvedAt time.Time `json:"solvedAt"`
}

var cachedChallengesMap map[string](bundle.JuiceShopChallenge)

type ScoringService struct {
	bundle              *bundle.Bundle
	currentScores       map[string]*TeamScore
	currentScoresSorted []*TeamScore
	currentScoresMutex  *sync.Mutex

	challengesMap map[string](bundle.JuiceShopChallenge)
}

func NewScoringService(bundle *bundle.Bundle) *ScoringService {
	return NewScoringServiceWithInitialScores(bundle, make(map[string]*TeamScore))
}

func NewScoringServiceWithInitialScores(b *bundle.Bundle, initialScores map[string]*TeamScore) *ScoringService {
	// create a map of challenges for easy lookup by challenge key
	cachedChallengesMap = make(map[string](bundle.JuiceShopChallenge))
	for _, challenge := range b.JuiceShopChallenges {
		cachedChallengesMap[challenge.Key] = challenge
	}

	return &ScoringService{
		bundle:              b,
		currentScores:       initialScores,
		currentScoresSorted: sortTeamsByScoreAndCalculatePositions(initialScores),
		currentScoresMutex:  &sync.Mutex{},

		challengesMap: cachedChallengesMap,
	}
}

func (s *ScoringService) GetScores() map[string]*TeamScore {
	return s.currentScores
}

func (s *ScoringService) GetTopScores() []*TeamScore {
	return s.currentScoresSorted
}

// StartingScoringWorker starts a worker that listens for changes in JuiceShop deployments and updates the scores accordingly
func (s *ScoringService) StartingScoringWorker(ctx context.Context) {
	watcher, err := s.bundle.ClientSet.AppsV1().Deployments(s.bundle.RuntimeEnvironment.Namespace).Watch(ctx, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
	})

	if err != nil {
		s.bundle.Log.Printf("Failed to start the watcher for JuiceShop deployments: %v", err)
		panic(err)
	}
	defer watcher.Stop()

	for {
		select {
		case event, ok := <-watcher.ResultChan():
			if !ok {
				s.bundle.Log.Printf("Watcher for JuiceShop deployments has been closed. Exiting the watcher.")
				return
			}
			switch event.Type {
			case watch.Added, watch.Modified:
				deployment := event.Object.(*appsv1.Deployment)
				score := calculateScore(s.bundle, deployment, cachedChallengesMap)

				if currentTeamScore, ok := s.currentScores[score.Name]; ok {
					if reflect.DeepEqual(currentTeamScore.Score, score.Score) {
						// No need to update, if the score hasn't changed
						continue
					}
				}

				s.currentScoresMutex.Lock()
				s.currentScores[score.Name] = score
				s.currentScoresSorted = sortTeamsByScoreAndCalculatePositions(s.currentScores)
				s.currentScoresMutex.Unlock()
			case watch.Deleted:
				deployment := event.Object.(*appsv1.Deployment)
				team := deployment.Labels["team"]
				s.currentScoresMutex.Lock()
				delete(s.currentScores, team)
				s.currentScoresSorted = sortTeamsByScoreAndCalculatePositions(s.currentScores)
				s.currentScoresMutex.Unlock()
			default:
				s.bundle.Log.Printf("Unknown event type: %v", event.Type)
			}
		case <-ctx.Done():
			s.bundle.Log.Printf("Context canceled. Exiting the watcher.")
			return
		}
	}
}

func (s *ScoringService) CalculateAndCacheScoreBoard(context context.Context) error {
	// Get all JuiceShop instances
	juiceShops, err := getDeployments(context, s.bundle)
	if err != nil {
		return err
	}

	// Calculate the new scores
	s.currentScoresMutex.Lock()
	for _, juiceShop := range juiceShops.Items {
		score := calculateScore(s.bundle, &juiceShop, s.challengesMap)
		s.currentScores[score.Name] = score
	}
	s.currentScoresSorted = sortTeamsByScoreAndCalculatePositions(s.currentScores)
	s.currentScoresMutex.Unlock()

	return nil
}

func getDeployments(context context.Context, bundle *bundle.Bundle) (*appsv1.DeploymentList, error) {
	deployments, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).List(context, metav1.ListOptions{
		LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
	})
	if err != nil {
		return nil, err
	}
	return deployments, nil
}

func calculateScore(bundle *bundle.Bundle, teamDeployment *appsv1.Deployment, challengesMap map[string](bundle.JuiceShopChallenge)) *TeamScore {
	solvedChallengesString := teamDeployment.Annotations["multi-juicer.owasp-juice.shop/challenges"]
	team := teamDeployment.Labels["team"]
	if solvedChallengesString == "" {
		return &TeamScore{
			Name:       team,
			Score:      0,
			Challenges: []ChallengeProgress{},
		}
	}

	solvedChallenges := []ChallengeProgress{}
	err := json.Unmarshal([]byte(solvedChallengesString), &solvedChallenges)

	if err != nil {
		bundle.Log.Printf("JuiceShop deployment '%s' has an invalid 'multi-juicer.owasp-juice.shop/challenges' annotation. Assuming 0 solved challenges for it as the score can't be calculated.", team)
		return &TeamScore{
			Name:       team,
			Score:      0,
			Challenges: []ChallengeProgress{},
		}
	}

	score := 0
	solvedChallengeNames := []ChallengeProgress{}
	for _, challengeSolved := range solvedChallenges {
		challenge, ok := challengesMap[challengeSolved.Key]
		if !ok {
			bundle.Log.Printf("JuiceShop deployment '%s' has a solved challenge '%s' that is not in the challenges map. The used JuiceShop version might be incompatible with this MultiJuicer version.", team, challengeSolved.Key)
			continue
		}
		score += challenge.Difficulty * 10
		solvedChallengeNames = append(solvedChallengeNames, challengeSolved)
	}

	return &TeamScore{
		Name:       team,
		Score:      score,
		Challenges: solvedChallengeNames,
	}
}

func getLatestChallengeSolve(challenges []ChallengeProgress) time.Time {
	var maxTime time.Time
	for _, challenge := range challenges {
		if challenge.SolvedAt.After(maxTime) {
			maxTime = challenge.SolvedAt
		}
	}
	return maxTime
}

func sortTeamsByScoreAndCalculatePositions(teamScores map[string]*TeamScore) []*TeamScore {
	sortedTeamScores := make([]*TeamScore, len(teamScores))

	i := 0
	for _, teamScore := range teamScores {
		sortedTeamScores[i] = teamScore
		i++
	}

	sort.Slice(sortedTeamScores, func(i, j int) bool {
		if sortedTeamScores[i].Score == sortedTeamScores[j].Score {
			iTime := getLatestChallengeSolve(sortedTeamScores[i].Challenges)
			jTime := getLatestChallengeSolve(sortedTeamScores[j].Challenges)
			if iTime == jTime {
				return sortedTeamScores[i].Name < sortedTeamScores[j].Name
			}
			return iTime.Before(jTime)
		}
		return sortedTeamScores[i].Score > sortedTeamScores[j].Score
	})

	// set the position of each team, teams with the same score have the same position
	position := 1
	for i := 0; i < len(sortedTeamScores); i++ {
		if i > 0 && sortedTeamScores[i].Score < sortedTeamScores[i-1].Score {
			position = i + 1
		}
		sortedTeamScores[i].Position = position
	}

	return sortedTeamScores
}
