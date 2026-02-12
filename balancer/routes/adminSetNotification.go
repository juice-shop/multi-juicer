package routes

import (
	"encoding/json"
	"net/http"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
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

			// Use the NotificationService to set the notification
			if err := bundle.NotificationService.SetNotification(req.Context(), notificationReq.Message, notificationReq.Enabled); err != nil {
				bundle.Log.Printf("Failed to set notification: %v", err)
				http.Error(responseWriter, "", http.StatusInternalServerError)
				return
			}

			// Return success response
			responseWriter.Header().Set("Content-Type", "application/json")
			responseWriter.WriteHeader(http.StatusOK)
			json.NewEncoder(responseWriter).Encode(AdminNotificationResponse{Success: true})
		},
	)
}
