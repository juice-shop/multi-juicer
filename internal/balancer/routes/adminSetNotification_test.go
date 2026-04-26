package routes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/internal/notification"
	"github.com/juice-shop/multi-juicer/internal/testutil"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAdminPostNotificationHandler(t *testing.T) {
	t.Run("requires admin authentication", func(t *testing.T) {
		requestBody := AdminNotificationRequest{
			Message: "Test notification",
			Enabled: true,
		}
		bodyBytes, _ := json.Marshal(requestBody)

		req, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("some-team")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("creates ConfigMap on first post", func(t *testing.T) {
		requestBody := AdminNotificationRequest{
			Message: "System maintenance scheduled",
			Enabled: true,
		}
		bodyBytes, _ := json.Marshal(requestBody)

		req, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		var response AdminNotificationResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)
		assert.True(t, response.Success)

		// Verify ConfigMap was created
		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			req.Context(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)
		assert.NotNil(t, cm)
		assert.Contains(t, cm.Data["notification.json"], "System maintenance scheduled")
	})

	t.Run("updates existing ConfigMap on subsequent posts", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService

		// First request
		requestBody1 := AdminNotificationRequest{
			Message: "First message",
			Enabled: true,
		}
		bodyBytes1, _ := json.Marshal(requestBody1)
		req1, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBuffer(bodyBytes1))
		req1.Header.Set("Content-Type", "application/json")
		req1.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr1 := httptest.NewRecorder()

		server := http.NewServeMux()
		AddRoutes(server, bundle)
		server.ServeHTTP(rr1, req1)

		assert.Equal(t, http.StatusOK, rr1.Code)

		// Second request (update)
		requestBody2 := AdminNotificationRequest{
			Message: "Updated message",
			Enabled: false,
		}
		bodyBytes2, _ := json.Marshal(requestBody2)
		req2, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBuffer(bodyBytes2))
		req2.Header.Set("Content-Type", "application/json")
		req2.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr2 := httptest.NewRecorder()

		server.ServeHTTP(rr2, req2)

		assert.Equal(t, http.StatusOK, rr2.Code)

		// Verify ConfigMap was updated
		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			req2.Context(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)
		assert.NotNil(t, cm)
		assert.Contains(t, cm.Data["notification.json"], "Updated message")
		assert.Contains(t, cm.Data["notification.json"], `"enabled":false`)
	})

	t.Run("rejects messages longer than 128 characters", func(t *testing.T) {
		var longMessage strings.Builder
		for range 129 {
			longMessage.WriteString("a")
		}

		requestBody := AdminNotificationRequest{
			Message: longMessage.String(),
			Enabled: true,
		}
		bodyBytes, _ := json.Marshal(requestBody)

		req, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.Contains(t, rr.Body.String(), "too long")
	})

	t.Run("handles invalid JSON", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBufferString("invalid json"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("preserves existing endDate when setting notification", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService

		// First, set an endDate via the clock endpoint
		futureDate := time.Now().Add(2 * time.Hour)
		clockBody, _ := json.Marshal(AdminClockRequest{EndDate: &futureDate})
		clockReq, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBuffer(clockBody))
		clockReq.Header.Set("Content-Type", "application/json")
		clockReq.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		clockRR := httptest.NewRecorder()

		server := http.NewServeMux()
		AddRoutes(server, bundle)
		server.ServeHTTP(clockRR, clockReq)
		assert.Equal(t, http.StatusOK, clockRR.Code)

		// Now set a notification
		notifBody, _ := json.Marshal(AdminNotificationRequest{Message: "Hello", Enabled: true})
		notifReq, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBuffer(notifBody))
		notifReq.Header.Set("Content-Type", "application/json")
		notifReq.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		notifRR := httptest.NewRecorder()
		server.ServeHTTP(notifRR, notifReq)
		assert.Equal(t, http.StatusOK, notifRR.Code)

		// Verify endDate is preserved
		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			notifReq.Context(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)
		assert.Contains(t, cm.Data["notification.json"], "endDate")
		assert.Contains(t, cm.Data["notification.json"], "Hello")
	})
}
