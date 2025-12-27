package routes

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/notifications"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

func handleCreateNotification(
	service *notifications.Service,
	bundle *bundle.Bundle,
) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, req *http.Request) {
		team, err := teamcookie.GetTeamFromRequest(bundle, req)
		if err != nil || team != "admin" {
			http.Error(responseWriter, "", http.StatusUnauthorized)
			return
		}
		var n struct {
			Team    string `json:"team"`
			Title   string `json:"title"`
			Message string `json:"message"`
			Level   string `json:"level"`
		}

		if err := json.NewDecoder(req.Body).Decode(&n); err != nil {
			http.Error(responseWriter, "invalid payload", http.StatusBadRequest)
			return
		}

		service.Add(notifications.Notification{
			Team:      n.Team,
			Title:     n.Title,
			Message:   n.Message,
			Level:     n.Level,
			CreatedAt: time.Now().UTC(),
		})

		responseWriter.WriteHeader(http.StatusCreated)
	})
}
