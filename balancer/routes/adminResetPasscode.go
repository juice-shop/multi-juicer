package routes

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	"golang.org/x/crypto/bcrypt"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func handleAdminResetPasscode(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil || team != "admin" {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			teamToReset := req.PathValue("team")
			if !isValidTeamName(teamToReset) {
				http.Error(responseWriter, "invalid team name", http.StatusBadRequest)
				return
			}

			newPasscode := bundle.GeneratePasscode()

			deployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(req.Context(), fmt.Sprintf("juiceshop-%s", teamToReset), metav1.GetOptions{})
			if err != nil {
				http.NotFound(responseWriter, req)
				return
			}

			passcodeHashBytes, err := bcrypt.GenerateFromPassword([]byte(newPasscode), bundle.BcryptRounds)
			if err != nil {
				bundle.Log.Printf("Failed to hash passcode!: %s", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}
			passcodeHash := string(passcodeHashBytes)

			patch, err := json.Marshal(map[string]interface{}{
				"metadata": map[string]interface{}{
					"annotations": map[string]interface{}{
						"multi-juicer.owasp-juice.shop/passcode": passcodeHash,
					},
				},
			})

			if err != nil {
				bundle.Log.Printf("Failed to convert passcode update patch to json: %v", err)
				http.Error(responseWriter, "Failed to update passcode", http.StatusInternalServerError)
				return
			}

			_, err = bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Patch(
				req.Context(),
				deployment.Name, types.StrategicMergePatchType,
				patch,
				metav1.PatchOptions{},
			)
			if err != nil {
				bundle.Log.Printf("Failed to update passcode for team '%s': %v", teamToReset, err)
				http.Error(responseWriter, "Failed to update passcode", http.StatusInternalServerError)
				return
			}

			responseBody := ResetPasscodeResponse{
				Message:  "Passcode reset successfully",
				Passcode: newPasscode,
			}
			responseBodyEncoded, err := json.Marshal(responseBody)
			if err != nil {
				bundle.Log.Printf("Failed to encode passcode reset response: %v", err)
				http.Error(responseWriter, "Failed to reset passcode", http.StatusInternalServerError)
				return
			}

			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Write(responseBodyEncoded)
		},
	)
}
