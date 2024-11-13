package routes

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/scoring"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type TeamStatus struct {
	Name             string `json:"name"`
	Score            int    `json:"score"`
	SolvedChallenges int    `json:"solvedChallenges"`
	Position         int    `json:"position"`
	TotalTeams       int    `json:"totalTeams"`
	Readiness        bool   `json:"readiness"`
}

func handleTeamStatus(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			bundle.Log.Printf("Awaiting readiness of JuiceShop Deployment for team '%s'", team)

			deployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(req.Context(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
			if err != nil {
				http.Error(responseWriter, "team not found", http.StatusNotFound)
				return
			}

			currentScores := scoring.GetScores()
			var teamScore scoring.TeamScore
			for _, score := range currentScores {
				if score.Name == team {
					teamScore = score
					break
				}
			}
			teamCount := len(currentScores)
			if teamScore.Name == "" {
				// the team is not in the score board, it should be there the next time the score-board worker finishes
				teamScore.Score = -1
				teamScore.Position = -1
				// increment the total count by one as we know that this teams hasn't been counted yet
				teamCount++
			}

			response := TeamStatus{
				Name:             team,
				Score:            teamScore.Score,
				Position:         teamScore.Position,
				TotalTeams:       teamCount,
				SolvedChallenges: len(teamScore.Challenges),
				Readiness:        deployment.Status.ReadyReplicas == 1,
			}

			responseBytes, err := json.Marshal(response)
			if err != nil {
				bundle.Log.Printf("Failed to marshal response: %s", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write(responseBytes)
		},
	)
}
