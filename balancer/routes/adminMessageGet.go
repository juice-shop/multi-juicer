package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/adminmessage"
	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
)

func handleGetAdminMessage(
	service *adminmessage.Service,
	bundle *bundle.Bundle,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		team, err := teamcookie.GetTeamFromRequest(bundle, r)
		if err != nil {
			bundle.Log.Println("error getting team", err)
			http.Error(w, "", http.StatusInternalServerError)
			return
		}
		if team == "admin" {
			http.Error(w, "admins should not subscribe to admin notifications", http.StatusBadRequest)
			return
		}
		fetchFunc := func(
			ctx context.Context,
			waitAfter *time.Time,
		) (*adminmessage.Message, time.Time, bool, error) {
			if waitAfter != nil {
				msg, ts, ok := service.WaitForUpdatesNewerThan(ctx, *waitAfter)
				if !ok {
					return nil, time.Time{}, false, nil
				}
				return msg, ts, true, nil
			}

			msg, ts := service.Get()
			return msg, ts, msg != nil, nil
		}

		msg, ts, status, err := longpoll.HandleLongPoll(r, fetchFunc)
		if err != nil {
			bundle.Log.Printf("Long poll error: %s\n", err)
			http.Error(w, "error during long poll", status)
			return
		}
		if status == http.StatusNoContent {
			w.WriteHeader(http.StatusNoContent)
			w.Write([]byte{})
			return
		}

		responseBytes, marshalErr := json.Marshal(msg)
		if marshalErr != nil {
			bundle.Log.Println("failed to marshal response", err)
			http.Error(w, "", http.StatusInternalServerError)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Last-Modified", ts.UTC().Format(time.RFC1123))
		w.Header().Set("X-Last-Update", ts.UTC().Format(time.RFC3339))
		w.WriteHeader(http.StatusOK)
		w.Write(responseBytes)
	})
}
