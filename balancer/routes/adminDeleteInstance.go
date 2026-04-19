package routes

import (
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func handleAdminDeleteInstance(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			teamToDelete := req.PathValue("team")
			if !isValidTeamName(teamToDelete) {
				http.Error(responseWriter, "invalid team name", http.StatusBadRequest)
				return
			}

			// Only the deployment needs to be deleted explicitly.
			// The service and secret are owned by the deployment via OwnerReferences and will be garbage collected by Kubernetes.
			err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Delete(req.Context(), fmt.Sprintf("juiceshop-%s", teamToDelete), metav1.DeleteOptions{})
			if err != nil && !errors.IsNotFound(err) {
				bundle.Log.Error("Failed to delete deployment", "team", teamToDelete, "error", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Write([]byte{}) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter.no-direct-write-to-responsewriter
		},
	)
}
