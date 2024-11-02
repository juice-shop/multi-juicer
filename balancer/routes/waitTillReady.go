package routes

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func handleWaitTillReady(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team := req.PathValue("team")
			if team == "" {
				http.Error(responseWriter, "team parameter is missing", http.StatusBadRequest)
				return
			}

			teamFromCookie, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil || teamFromCookie != team {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			bundle.Log.Printf("Awaiting readiness of JuiceShop Deployment for team '%s'", team)

			// Loop to check readiness with a 30-second timeout (60 iterations of 0.5 seconds sleep)
			for i := 0; i < 60; i++ {
				// Get deployment for the specific team
				deployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
				if err != nil && errors.IsNotFound(err) {
					http.Error(responseWriter, "team not found", http.StatusNotFound)
					return
				} else if err != nil {
					bundle.Log.Printf("Error fetching deployment for team '%s': %v", team, err)
					http.Error(responseWriter, "Error fetching deployment", http.StatusInternalServerError)
					return
				}

				// Check if deployment is ready
				if deployment.Status.ReadyReplicas == 1 {
					bundle.Log.Printf("JuiceShop Deployment for team '%s' is ready", team)
					responseWriter.WriteHeader(http.StatusOK)
					return
				}

				time.Sleep(500 * time.Millisecond)
			}

			// If the loop finishes without the deployment becoming ready
			bundle.Log.Printf("Waiting for deployment of team '%s' timed out", team)
			http.Error(responseWriter, "Waiting for Deployment Readiness Timed Out", http.StatusInternalServerError)
		},
	)
}
