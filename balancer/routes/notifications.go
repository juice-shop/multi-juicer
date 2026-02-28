package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
)

type NotificationResponse struct {
	Message   string     `json:"message"`
	Enabled   bool       `json:"enabled"`
	UpdatedAt time.Time  `json:"updatedAt"`
	EndDate   *time.Time `json:"endDate,omitempty"`
}

func handleNotifications(b *bundle.Bundle) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Define the fetch function for long polling
		fetchFunc := func(ctx context.Context, waitAfter *time.Time) (*NotificationResponse, time.Time, bool, error) {
			if waitAfter != nil {
				// Long polling: wait for updates newer than waitAfter
				notification, lastUpdateTime, hasUpdate := b.NotificationService.WaitForUpdatesNewerThan(ctx, *waitAfter)
				if !hasUpdate {
					// Timeout, no updates
					return nil, time.Time{}, false, nil
				}
				if notification == nil {
					return &NotificationResponse{
						Message:   "",
						Enabled:   false,
						UpdatedAt: lastUpdateTime,
					}, lastUpdateTime, true, nil
				}
				return &NotificationResponse{
					Message:   notification.Message,
					Enabled:   notification.Enabled,
					UpdatedAt: lastUpdateTime,
					EndDate:   notification.EndDate,
				}, lastUpdateTime, true, nil
			}

			// Initial fetch: return current notification immediately
			notification, lastUpdateTime := b.NotificationService.GetNotificationWithTimestamp()
			if notification == nil {
				return &NotificationResponse{
					Message:   "",
					Enabled:   false,
					UpdatedAt: lastUpdateTime,
				}, lastUpdateTime, true, nil
			}
			return &NotificationResponse{
				Message:   notification.Message,
				Enabled:   notification.Enabled,
				UpdatedAt: lastUpdateTime,
				EndDate:   notification.EndDate,
			}, lastUpdateTime, true, nil
		}

		response, lastUpdateTime, statusCode, err := longpoll.HandleLongPoll(r, fetchFunc)
		if err != nil {
			b.Log.Printf("Long poll error: %s", err)
			http.Error(w, "Invalid time format", statusCode)
			return
		}

		if statusCode == http.StatusNoContent {
			w.WriteHeader(http.StatusNoContent)
			w.Write([]byte{})
			return
		}

		responseBytes, marshalErr := json.Marshal(response)
		if marshalErr != nil {
			b.Log.Printf("Failed to marshal notification response: %s", marshalErr)
			http.Error(w, "", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Last-Update", lastUpdateTime.UTC().Format(time.RFC3339Nano))
		w.WriteHeader(http.StatusOK)
		w.Write(responseBytes)
	})
}
