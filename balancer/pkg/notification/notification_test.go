package notification

import (
	"context"
	"encoding/json"
	b "github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestParseAndUpdateNotification(t *testing.T) {
	t.Run("parses valid notification from ConfigMap", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		notificationData := b.Notification{
			Message:   "Test notification",
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

		service.parseAndUpdateNotification(cm)

		notification, _ := service.GetNotificationWithTimestamp()
		assert.NotNil(t, notification)
		assert.Equal(t, "Test notification", notification.Message)
		assert.True(t, notification.Enabled)
	})

	t.Run("handles nil ConfigMap", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		service.parseAndUpdateNotification(nil)

		notification, _ := service.GetNotificationWithTimestamp()
		assert.Nil(t, notification)
	})

	t.Run("handles disabled notification", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		notificationData := b.Notification{
			Message:   "Test notification",
			Enabled:   false,
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

		service.parseAndUpdateNotification(cm)

		// Should return nil for disabled notifications
		notification, _ := service.GetNotificationWithTimestamp()
		assert.Nil(t, notification)
	})

	t.Run("handles invalid JSON", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		cm := &corev1.ConfigMap{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "multi-juicer-notification",
				Namespace: bundle.RuntimeEnvironment.Namespace,
			},
			Data: map[string]string{
				"notification.json": "invalid json",
			},
		}

		service.parseAndUpdateNotification(cm)

		notification, _ := service.GetNotificationWithTimestamp()
		assert.Nil(t, notification)
	})
}

func TestWaitForUpdatesNewerThan(t *testing.T) {
	t.Run("returns immediately if data is already newer (fast path)", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		// Set up a notification
		notificationData := b.Notification{
			Message:   "Test notification",
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

		service.parseAndUpdateNotification(cm)

		// Wait for updates newer than 1 second ago
		oldTime := time.Now().Add(-1 * time.Second)
		ctx := context.Background()

		start := time.Now()
		notification, _, hasUpdate := service.WaitForUpdatesNewerThan(ctx, oldTime)
		elapsed := time.Since(start)

		assert.True(t, hasUpdate)
		assert.NotNil(t, notification)
		assert.Equal(t, "Test notification", notification.Message)
		// Should return almost immediately (fast path)
		assert.Less(t, elapsed, 100*time.Millisecond)
	})

	t.Run("times out if no updates", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		// No notification set
		ctx := context.Background()
		futureTime := time.Now().Add(1 * time.Hour)

		start := time.Now()
		_, _, hasUpdate := service.WaitForUpdatesNewerThan(ctx, futureTime)
		elapsed := time.Since(start)

		assert.False(t, hasUpdate)
		// Should wait for full timeout (25 seconds)
		assert.GreaterOrEqual(t, elapsed, 24*time.Second)
	})

	t.Run("respects context cancellation", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()

		futureTime := time.Now().Add(1 * time.Hour)

		start := time.Now()
		_, _, hasUpdate := service.WaitForUpdatesNewerThan(ctx, futureTime)
		elapsed := time.Since(start)

		assert.False(t, hasUpdate)
		// Should return quickly due to context cancellation
		assert.Less(t, elapsed, 200*time.Millisecond)
	})
}
