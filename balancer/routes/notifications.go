package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
	"github.com/juice-shop/multi-juicer/balancer/pkg/notifications"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

func handleGetNotifications(
	bundle *b.Bundle,
	service *notifications.Service,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		team, _ := teamcookie.GetTeamFromRequest(bundle, r)

		fetchFunc := func(
			ctx context.Context,
			waitAfter *time.Time,
		) ([]notifications.Notification, time.Time, bool, error) {

			if waitAfter != nil {
				data, lastUpdate, hasUpdate :=
					service.WaitForUpdatesNewerThan(ctx, *waitAfter, team)

				if !hasUpdate {
					return nil, time.Time{}, false, nil
				}
				return data, lastUpdate, true, nil
			}

			data, lastUpdate :=
				service.GetCurrent(team)

			return data, lastUpdate, true, nil
		}

		data, lastUpdate, status, err :=
			longpoll.HandleLongPoll(r, fetchFunc)

		if err != nil {
			http.Error(w, err.Error(), status)
			return
		}

		if status == http.StatusNoContent {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Last-Update", lastUpdate.Format(time.RFC3339))
		json.NewEncoder(w).Encode(data)
	})
}
