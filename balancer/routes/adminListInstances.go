package routes

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AdminListInstancesResponse struct {
	Instances []AdminListJuiceShopInstance `json:"instances"`
}

type AdminListJuiceShopInstance struct {
	Team              string            `json:"team"`
	Ready             bool              `json:"ready"`
	CreatedAt         int64             `json:"createdAt"`
	LastConnect       int64             `json:"lastConnect"`
	CheatScore        *float64          `json:"cheatScore,omitempty"`
	CheatScoreHistory []CheatScoreEntry `json:"cheatScoreHistory,omitempty"`
}

type CheatScoreEntry struct {
	TotalCheatScore float64 `json:"totalCheatScore"`
	Timestamp       string  `json:"timestamp"`
}

func handleAdminListInstances(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			deployments, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).List(req.Context(), metav1.ListOptions{
				LabelSelector: "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer",
			})
			if err != nil {
				bundle.Log.Printf("Failed to list deployments: %s", err)
				http.Error(responseWriter, "unable to get instances", http.StatusInternalServerError)
				return
			}

			instances := []AdminListJuiceShopInstance{}
			for _, teamDeployment := range deployments.Items {

				lastConnectAnnotation := teamDeployment.Annotations["multi-juicer.owasp-juice.shop/lastRequest"]
				lastConnection := time.UnixMilli(0)

				if lastConnectAnnotation != "" {
					millis, err := strconv.ParseInt(lastConnectAnnotation, 10, 64)
					if err != nil {
						millis = 0
					}
					lastConnection = time.UnixMilli(millis)
				}

				// Parse cheat scores and get the newest one
				var cheatScore *float64
				var cheatScores []CheatScoreEntry
				cheatScoresAnnotation := teamDeployment.Annotations["multi-juicer.owasp-juice.shop/cheatScores"]
				if cheatScoresAnnotation != "" {
					err := json.Unmarshal([]byte(cheatScoresAnnotation), &cheatScores)
					if err == nil && len(cheatScores) > 0 {
						// Get the newest cheat score (last entry in the array)
						newestScore := cheatScores[len(cheatScores)-1].TotalCheatScore
						cheatScore = &newestScore
					}
				}

				instances = append(instances, AdminListJuiceShopInstance{
					Team:              teamDeployment.Labels["team"],
					Ready:             teamDeployment.Status.ReadyReplicas == 1,
					CreatedAt:         teamDeployment.CreationTimestamp.UnixMilli(),
					LastConnect:       lastConnection.UnixMilli(),
					CheatScore:        cheatScore,
					CheatScoreHistory: cheatScores,
				})
			}

			response := AdminListInstancesResponse{
				Instances: instances,
			}

			responseBody, _ := json.Marshal(response)
			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write(responseBody)
		},
	)
}
