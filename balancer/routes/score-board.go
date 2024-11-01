package routes

import (
	"encoding/json"
	"net/http"
	"sort"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type TeamScore struct {
	Name       string   `json:"name"`
	Score      int      `json:"score"`
	Challenges []string `json:"challenges"`
}

type ScoreBoardResponse struct {
	TotalTeams int         `json:"totalTeams"`
	TopTeams   []TeamScore `json:"teams"`
}

// PersistedChallengeProgress is stored as a json array on the JuiceShop deployments, saving which challenges have been solved and when
type PersistedChallengeProgress struct {
	Key      string `json:"key"`
	SolvedAt string `json:"solvedAt"`
}

func handleScoreBoard(bundle *b.Bundle) http.Handler {

	// create a map of challenges
	challengesMap := make(map[string](b.JuiceShopChallenge))
	for _, challenge := range bundle.JuiceShopChallenges {
		challengesMap[challenge.Key] = challenge
	}

	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			deployments, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).List(req.Context(), metav1.ListOptions{
				LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
			})
			if err != nil {
				bundle.Log.Printf("Failed to list deployments: %s", err)
				http.Error(responseWriter, "unable to get team scores", http.StatusInternalServerError)
				return
			}

			teamScores := []TeamScore{}

			for _, teamDeployment := range deployments.Items {
				solvedChallengesString := teamDeployment.Annotations["multi-juicer.owasp-juice.shop/challenges"]
				team := teamDeployment.Labels["team"]
				if solvedChallengesString == "" {
					teamScores = append(teamScores, TeamScore{
						Name:       team,
						Score:      0,
						Challenges: []string{},
					})
					continue
				}

				solvedChallenges := []PersistedChallengeProgress{}
				err = json.Unmarshal([]byte(solvedChallengesString), &solvedChallenges)

				if err != nil {
					bundle.Log.Printf("JuiceShop deployment '%s' has an invalid 'multi-juicer.owasp-juice.shop/challenges' annotation. Assuming 0 solved challenges for it as the score can't be calculated.", team)
					teamScores = append(teamScores, TeamScore{
						Name:       team,
						Score:      0,
						Challenges: []string{},
					})
					continue
				}

				score := 0

				for _, challengeSolved := range solvedChallenges {
					challenge, ok := challengesMap[challengeSolved.Key]
					if !ok {
						continue
					}
					score += challenge.Difficulty * 10
				}

				solvedChallengeNames := []string{}
				for _, challengeSolved := range solvedChallenges {
					solvedChallengeNames = append(solvedChallengeNames, challengeSolved.Key)
				}

				teamScores = append(teamScores, TeamScore{
					Name:       team,
					Score:      score,
					Challenges: solvedChallengeNames,
				})
			}

			sort.Slice(teamScores, func(i, j int) bool {
				return teamScores[i].Score > teamScores[j].Score
			})

			response := ScoreBoardResponse{
				TotalTeams: len(teamScores),
				TopTeams:   teamScores,
			}

			responseBytes, err := json.Marshal(response)
			if err != nil {
				http.Error(responseWriter, "failed to marshal response", http.StatusInternalServerError)
				return
			}

			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Write(responseBytes)
			responseWriter.WriteHeader(http.StatusOK)
		},
	)
}
