package routes

import (
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func handleAdminRestartInstance(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil || team != "admin" {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			teamToRestart := req.PathValue("team")
			if !isValidTeamName(teamToRestart) {
				http.Error(responseWriter, "invalid team name", http.StatusBadRequest)
				return
			}

			// find pod for service

			pods, err := bundle.ClientSet.CoreV1().Pods(bundle.RuntimeEnvironment.Namespace).List(req.Context(), metav1.ListOptions{
				LabelSelector: fmt.Sprintf("app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer,team=%s", teamToRestart),
			})

			if err != nil {
				bundle.Log.Printf("Failed to list pods for team '%s': %s", teamToRestart, err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			if len(pods.Items) != 1 {
				http.Error(responseWriter, "", http.StatusNotFound)
				return
			}

			// delete pod
			pod := pods.Items[0]

			err = bundle.ClientSet.CoreV1().Pods(bundle.RuntimeEnvironment.Namespace).Delete(req.Context(), pod.Name, metav1.DeleteOptions{})

			if err != nil {
				bundle.Log.Printf("Failed to restart pods for team '%s': %s", teamToRestart, err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write([]byte{})
		},
	)
}
