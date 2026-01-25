package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/adminmessage"
	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/teamcookie"
	v1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func handleSetAdminMessage(
	b *bundle.Bundle,
) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {

		team, err := teamcookie.GetTeamFromRequest(b, r)
		if err != nil || team != "admin" {
			http.Error(w, "", http.StatusUnauthorized)
			return
		}

		var payload struct {
			Text string `json:"text"`
		}

		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}

		now := time.Now().UTC()

		cm := &v1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name: adminmessage.ConfigMapName,
			},
			Data: map[string]string{
				"text":      payload.Text,
				"updatedAt": now.Format(time.RFC3339),
			},
		}

		client := b.ClientSet.CoreV1().
			ConfigMaps(b.RuntimeEnvironment.Namespace)

		_, err = client.Update(context.Background(), cm, metav1.UpdateOptions{})
		if apierrors.IsNotFound(err) {
			_, err = client.Create(context.Background(), cm, metav1.CreateOptions{})
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusCreated)
	})
}
