package teams

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func HandleWaitTillReady(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team := req.PathValue("team")
			if team == "" {
				http.Error(responseWriter, "team parameter is missing", http.StatusBadRequest)
				return
			}

			log.Default().Printf("Awaiting readiness of JuiceShop Deployment for team '%s'", team)

			// Loop to check readiness with a 180-second timeout (180 iterations of 1 second sleep)
			for i := 0; i < 180; i++ {
				// Get deployment for the specific team
				deployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
				if err != nil {
					log.Default().Printf("Error fetching deployment for team '%s': %v", team, err)
					http.Error(responseWriter, "Error fetching deployment", http.StatusInternalServerError)
					return
				}

				// Check if deployment is ready
				if deployment.Status.ReadyReplicas == 1 {
					log.Default().Printf("JuiceShop Deployment for team '%s' is ready", team)
					responseWriter.WriteHeader(http.StatusOK)
					return
				}

				// Wait for 1 second before retrying
				time.Sleep(1 * time.Second)
			}

			// If the loop finishes without the deployment becoming ready
			log.Default().Printf("Waiting for deployment of team '%s' timed out", team)
			http.Error(responseWriter, "Waiting for Deployment Readiness Timed Out", http.StatusInternalServerError)
		},
	)
}
