package routes

import (
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func handleAdminDeleteInstance(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil || team != "admin" {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			teamToDelete := req.PathValue("team")
			if !isValidTeamName(teamToDelete) {
				http.Error(responseWriter, "invalid team name", http.StatusBadRequest)
				return
			}

			err = bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Delete(req.Context(), fmt.Sprintf("juiceshop-%s", teamToDelete), metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				bundle.Log.Printf("Failed to delete deployment for team '%s': %s", teamToDelete, err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}
			err = bundle.ClientSet.CoreV1().Services(bundle.RuntimeEnvironment.Namespace).Delete(req.Context(), fmt.Sprintf("juiceshop-%s", teamToDelete), metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				bundle.Log.Printf("Failed to delete service for team '%s': %s", teamToDelete, err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write([]byte{})
		},
	)
}
