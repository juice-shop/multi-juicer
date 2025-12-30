package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/adminmessage"
	"github.com/juice-shop/multi-juicer/balancer/pkg/longpoll"
)

func handleGetAdminMessage(
	service *adminmessage.Service,
) http.Handler {

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		fetchFunc := func(
			ctx context.Context,
			waitAfter *time.Time,
		) (*adminmessage.Message, time.Time, bool, error) {

			if waitAfter != nil {
				msg, ts, ok :=
					service.WaitForUpdatesNewerThan(ctx, *waitAfter)
				if !ok {
					return nil, time.Time{}, false, nil
				}
				return msg, ts, true, nil
			}

			msg, ts := service.Get()
			return msg, ts, msg != nil, nil
		}

		msg, ts, status, err :=
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
		w.Header().Set("X-Last-Update", ts.Format(time.RFC3339))
		json.NewEncoder(w).Encode(msg)
	})
}
