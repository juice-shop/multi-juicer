package routes

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type AdminNotificationRequest struct {
	Message string `json:"message"`
	Enabled bool   `json:"enabled"`
}

type AdminNotificationResponse struct {
	Success bool `json:"success"`
}

func handleAdminPostNotification(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			// Check admin authentication
			team, err := teamcookie.GetTeamFromRequest(bundle, req)
			if err != nil || team != "admin" {
				http.Error(responseWriter, "", http.StatusUnauthorized)
				return
			}

			// Parse request body
			var notificationReq AdminNotificationRequest
			if err := json.NewDecoder(req.Body).Decode(&notificationReq); err != nil {
				http.Error(responseWriter, "invalid JSON", http.StatusBadRequest)
				return
			}

			// Validate message length
			if len(notificationReq.Message) > 128 {
				http.Error(responseWriter, "message too long (max 128 characters)", http.StatusBadRequest)
				return
			}

			// Build notification JSON
			notificationData := struct {
				Message   string    `json:"message"`
				Enabled   bool      `json:"enabled"`
				UpdatedAt time.Time `json:"updatedAt"`
			}{
				Message:   notificationReq.Message,
				Enabled:   notificationReq.Enabled,
				UpdatedAt: time.Now(),
			}

			notificationJSON, err := json.Marshal(notificationData)
			if err != nil {
				bundle.Log.Printf("Failed to marshal notification JSON: %v", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			// ConfigMap name
			const configMapName = "multi-juicer-notification"

			// Try to get existing ConfigMap
			existingCM, err := bundle.ClientSet.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
				req.Context(),
				configMapName,
				metav1.GetOptions{},
			)

			if err != nil {
				if errors.IsNotFound(err) {
					// Create new ConfigMap
					configMap := &corev1.ConfigMap{
						ObjectMeta: metav1.ObjectMeta{
							Name:      configMapName,
							Namespace: bundle.RuntimeEnvironment.Namespace,
						},
						Data: map[string]string{
							"notification.json": string(notificationJSON),
						},
					}

					_, err = bundle.ClientSet.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Create(
						req.Context(),
						configMap,
						metav1.CreateOptions{},
					)
					if err != nil {
						bundle.Log.Printf("Failed to create notification ConfigMap: %v", err)
						http.Error(responseWriter, "", http.StatusInternalServerError)
						return
					}
				} else {
					bundle.Log.Printf("Failed to get notification ConfigMap: %v", err)
					http.Error(responseWriter, "", http.StatusInternalServerError)
					return
				}
			} else {
				// Update existing ConfigMap
				existingCM.Data = map[string]string{
					"notification.json": string(notificationJSON),
				}

				_, err = bundle.ClientSet.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Update(
					req.Context(),
					existingCM,
					metav1.UpdateOptions{},
				)
				if err != nil {
					bundle.Log.Printf("Failed to update notification ConfigMap: %v", err)
					http.Error(responseWriter, "", http.StatusInternalServerError)
					return
				}
			}

			// Return success response
			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.WriteHeader(http.StatusOK)
			json.NewEncoder(responseWriter).Encode(AdminNotificationResponse{Success: true})
		},
	)
}
