package routes

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"golang.org/x/crypto/bcrypt"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

func handleAdminResetPasscode(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
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
				bundle.Log.Error("Failed to hash passcode", "team", teamToReset, "error", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}
			passcodeHash := string(passcodeHashBytes)

			patch, err := json.Marshal(map[string]any{
				"metadata": map[string]any{
					"annotations": map[string]any{
						"multi-juicer.owasp-juice.shop/passcode": passcodeHash,
					},
				},
			})

			if err != nil {
				bundle.Log.Error("Failed to convert passcode update patch to json", "team", teamToReset, "error", err)
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
				bundle.Log.Error("Failed to update passcode", "team", teamToReset, "error", err)
				http.Error(responseWriter, "Failed to update passcode", http.StatusInternalServerError)
				return
			}

			responseBody := ResetPasscodeResponse{
				Message:  "Passcode reset successfully",
				Passcode: newPasscode,
			}
			responseBodyEncoded, err := json.Marshal(responseBody)
			if err != nil {
				bundle.Log.Error("Failed to encode passcode reset response", "team", teamToReset, "error", err)
				http.Error(responseWriter, "Failed to reset passcode", http.StatusInternalServerError)
				return
			}

			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Write(responseBodyEncoded) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter.no-direct-write-to-responsewriter
		},
	)
}
