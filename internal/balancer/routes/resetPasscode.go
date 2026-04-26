package routes

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/teamcookie"
	"golang.org/x/crypto/bcrypt"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type ResetPasscodeResponse struct {
	Message  string `json:"message"`
	Passcode string `json:"passcode"`
}

func handleResetPasscode(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {

			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			newPasscode := bundle.GeneratePasscode()

			deployment, err := bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Get(req.Context(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
			if err != nil {
				http.NotFound(responseWriter, req)
				return
			}

			passcodeHashBytes, err := bcrypt.GenerateFromPassword([]byte(newPasscode), bundle.BcryptRounds)
			if err != nil {
				bundle.Log.Error("Failed to hash passcode", "error", err)
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
				bundle.Log.Error("Failed to convert passcode update patch to json", "error", err)
				http.Error(responseWriter, "Failed to update passcode", http.StatusInternalServerError)
				return
			}

			bundle.ClientSet.AppsV1().Deployments(bundle.RuntimeEnvironment.Namespace).Patch(
				req.Context(),
				deployment.Name, types.StrategicMergePatchType,
				patch,
				metav1.PatchOptions{},
			)

			responseBody := ResetPasscodeResponse{
				Message:  "Passcode reset successfully",
				Passcode: newPasscode,
			}
			responseBodyEncoded, err := json.Marshal(responseBody)
			if err != nil {
				bundle.Log.Error("Failed to encode passcode reset response", "error", err)
				http.Error(responseWriter, "Failed to reset passcode", http.StatusInternalServerError)
				return
			}

			responseWriter.WriteHeader(http.StatusOK)
			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.Write(responseBodyEncoded) // nosemgrep: go.lang.security.audit.xss.no-direct-write-to-responsewriter.no-direct-write-to-responsewriter
		},
	)
}
