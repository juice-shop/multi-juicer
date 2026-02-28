package routes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/notification"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAdminSetClockHandler(t *testing.T) {
	t.Run("requires admin authentication", func(t *testing.T) {
		futureDate := time.Now().Add(2 * time.Hour)
		requestBody := AdminClockRequest{EndDate: &futureDate}
		bodyBytes, _ := json.Marshal(requestBody)

		req, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBuffer(bodyBytes))
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

	t.Run("sets endDate successfully with future date", func(t *testing.T) {
		futureDate := time.Now().Add(2 * time.Hour)
		requestBody := AdminClockRequest{EndDate: &futureDate}
		bodyBytes, _ := json.Marshal(requestBody)

		req, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBuffer(bodyBytes))
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

		// Verify ConfigMap contains endDate
		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			req.Context(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)
		assert.Contains(t, cm.Data["notification.json"], "endDate")
	})

	t.Run("rejects past endDate", func(t *testing.T) {
		pastDate := time.Now().Add(-1 * time.Hour)
		requestBody := AdminClockRequest{EndDate: &pastDate}
		bodyBytes, _ := json.Marshal(requestBody)

		req, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBuffer(bodyBytes))
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
		assert.Contains(t, rr.Body.String(), "endDate must be in the future")
	})

	t.Run("clears endDate with null", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService

		server := http.NewServeMux()
		AddRoutes(server, bundle)

		// First set an endDate
		futureDate := time.Now().Add(2 * time.Hour)
		setBody, _ := json.Marshal(AdminClockRequest{EndDate: &futureDate})
		setReq, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBuffer(setBody))
		setReq.Header.Set("Content-Type", "application/json")
		setReq.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		setRR := httptest.NewRecorder()
		server.ServeHTTP(setRR, setReq)
		assert.Equal(t, http.StatusOK, setRR.Code)

		// Then clear it (null endDate)
		clearReq, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBufferString(`{"endDate":null}`))
		clearReq.Header.Set("Content-Type", "application/json")
		clearReq.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		clearRR := httptest.NewRecorder()
		server.ServeHTTP(clearRR, clearReq)
		assert.Equal(t, http.StatusOK, clearRR.Code)

		// Verify endDate is gone
		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			clearReq.Context(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)
		assert.NotContains(t, cm.Data["notification.json"], "endDate")
	})

	t.Run("handles invalid JSON", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBufferString("not json"))
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

	t.Run("preserves existing notification message when setting endDate", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		notificationService := notification.NewNotificationService(bundle)
		bundle.NotificationService = notificationService

		server := http.NewServeMux()
		AddRoutes(server, bundle)

		// First set a notification
		notifBody, _ := json.Marshal(AdminNotificationRequest{Message: "Important notice", Enabled: true})
		notifReq, _ := http.NewRequest("POST", "/balancer/api/admin/notifications", bytes.NewBuffer(notifBody))
		notifReq.Header.Set("Content-Type", "application/json")
		notifReq.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		notifRR := httptest.NewRecorder()
		server.ServeHTTP(notifRR, notifReq)
		assert.Equal(t, http.StatusOK, notifRR.Code)

		// Then set an endDate
		futureDate := time.Now().Add(2 * time.Hour)
		clockBody, _ := json.Marshal(AdminClockRequest{EndDate: &futureDate})
		clockReq, _ := http.NewRequest("POST", "/balancer/api/admin/clock", bytes.NewBuffer(clockBody))
		clockReq.Header.Set("Content-Type", "application/json")
		clockReq.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		clockRR := httptest.NewRecorder()
		server.ServeHTTP(clockRR, clockReq)
		assert.Equal(t, http.StatusOK, clockRR.Code)

		// Verify both message and endDate are present
		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			clockReq.Context(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)
		assert.Contains(t, cm.Data["notification.json"], "Important notice")
		assert.Contains(t, cm.Data["notification.json"], "endDate")
	})
}
