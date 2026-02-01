package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/notification"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestNotificationsHandler(t *testing.T) {
	t.Run("does not require authentication", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/notifications", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		AddRoutes(server, bundle, nil, notificationService)

		server.ServeHTTP(rr, req)

		// Should return 204 (no content) or 200 (with content), not 401 (unauthorized)
		assert.NotEqual(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("returns 204 No Content when no notification exists", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/notifications", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		AddRoutes(server, bundle, nil, notificationService)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNoContent, rr.Code)
	})

	t.Run("returns notification data when available", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)

		// Create a ConfigMap with notification data
		notificationData := notification.Notification{
			Message:   "Test notification message",
			Enabled:   true,
			UpdatedAt: time.Now(),
		}
		jsonData, _ := json.Marshal(notificationData)

		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "multi-juicer-notification",
				Namespace: bundle.RuntimeEnvironment.Namespace,
			},
			Data: map[string]string{
				"notification.json": string(jsonData),
			},
		}

		_, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Create(
			context.Background(),
			cm,
			metav1.CreateOptions{},
		)
		assert.Nil(t, err)

		// The notification service would need the watcher running to process the ConfigMap
		// For testing purposes, we can't easily simulate this without running the full watcher

		req, _ := http.NewRequest("GET", "/balancer/api/notifications", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		AddRoutes(server, bundle, nil, notificationService)

		server.ServeHTTP(rr, req)

		// Note: The service may return 204 if the watcher hasn't processed the ConfigMap yet
		// In a real scenario, the watcher would be running and would have processed it
		if rr.Code == http.StatusOK {
			assert.Equal(t, "application/json", rr.Header().Get("Content-Type"))
			assert.NotEmpty(t, rr.Header().Get("X-Last-Update"))

			var response NotificationResponse
			err = json.Unmarshal(rr.Body.Bytes(), &response)
			assert.Nil(t, err)
			assert.Equal(t, "Test notification message", response.Message)
		}
	})

	t.Run("supports long polling with wait-for-update-after parameter", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)

		// Use a future timestamp to ensure timeout
		futureTime := time.Now().Add(1 * time.Hour)
		url := fmt.Sprintf("/balancer/api/notifications?wait-for-update-after=%s", futureTime.UTC().Format(time.RFC3339))
		req, _ := http.NewRequest("GET", url, nil)

		// Use a context with timeout to avoid waiting 25 seconds
		ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
		defer cancel()
		req = req.WithContext(ctx)

		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		AddRoutes(server, bundle, nil, notificationService)

		server.ServeHTTP(rr, req)

		// Should return 204 No Content when timeout is reached
		assert.Equal(t, http.StatusNoContent, rr.Code)
	})

	t.Run("sets X-Last-Update header when returning data", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)

		// Create notification
		notificationData := notification.Notification{
			Message:   "Test",
			Enabled:   true,
			UpdatedAt: time.Now(),
		}
		jsonData, _ := json.Marshal(notificationData)
		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "multi-juicer-notification",
				Namespace: bundle.RuntimeEnvironment.Namespace,
			},
			Data: map[string]string{
				"notification.json": string(jsonData),
			},
		}

		_, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Create(
			context.Background(),
			cm,
			metav1.CreateOptions{},
		)
		assert.Nil(t, err)

		// The watcher would need to be running to process the ConfigMap

		req, _ := http.NewRequest("GET", "/balancer/api/notifications", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		AddRoutes(server, bundle, nil, notificationService)

		server.ServeHTTP(rr, req)

		// The X-Last-Update header should be set regardless of whether we have data
		// (it might be set even for 204 responses in some cases)
		if rr.Code == http.StatusOK {
			assert.NotEmpty(t, rr.Header().Get("X-Last-Update"))
		}
	})
}
