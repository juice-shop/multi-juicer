package routes

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
)

type AdminClockRequest struct {
	EndDate *time.Time `json:"endDate"`
}

func handleAdminSetClock(bundle *bundle.Bundle) http.Handler {
	return http.HandlerFunc(
		func(responseWriter http.ResponseWriter, req *http.Request) {
			// Parse request body
			var clockReq AdminClockRequest
			if err := json.NewDecoder(req.Body).Decode(&clockReq); err != nil {
				http.Error(responseWriter, "invalid JSON", http.StatusBadRequest)
				return
			}

			// Validate endDate is not in the past (when setting)
			if clockReq.EndDate != nil && clockReq.EndDate.Before(time.Now()) {
				http.Error(responseWriter, "endDate must be in the future", http.StatusBadRequest)
				return
			}

			// Use the NotificationService to set the end date
			if err := bundle.NotificationService.SetEndDate(req.Context(), clockReq.EndDate); err != nil {
				bundle.Log.Printf("Failed to set clock: %v", err)
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
