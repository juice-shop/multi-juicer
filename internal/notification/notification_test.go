package notification

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	b "github.com/juice-shop/multi-juicer/internal/bundle"

	"github.com/juice-shop/multi-juicer/internal/testutil"
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

		// Should return the notification even when disabled
		notification, _ := service.GetNotificationWithTimestamp()
		assert.NotNil(t, notification)
		assert.False(t, notification.Enabled)
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
		// Should wait for full timeout (3 seconds in test config)
		assert.GreaterOrEqual(t, elapsed, 2*time.Second)
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

func TestIsScoreboardFrozen(t *testing.T) {
	newService := func() *NotificationService {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		return NewNotificationService(bundle)
	}

	t.Run("not frozen when no notification is set", func(t *testing.T) {
		service := newService()
		service.parseAndUpdateNotification(nil)
		assert.False(t, service.IsScoreboardFrozen())
	})

	t.Run("not frozen when freezing is disabled even after end date", func(t *testing.T) {
		service := newService()
		past := time.Now().Add(-1 * time.Hour)
		service.currentNotification = &b.Notification{
			EndDate:               &past,
			FreezeScoreboardOnEnd: false,
		}
		assert.False(t, service.IsScoreboardFrozen())
	})

	t.Run("not frozen when freezing is enabled but end date is in the future", func(t *testing.T) {
		service := newService()
		future := time.Now().Add(1 * time.Hour)
		service.currentNotification = &b.Notification{
			EndDate:               &future,
			FreezeScoreboardOnEnd: true,
		}
		assert.False(t, service.IsScoreboardFrozen())
	})

	t.Run("not frozen when freezing is enabled but no end date is set", func(t *testing.T) {
		service := newService()
		service.currentNotification = &b.Notification{
			EndDate:               nil,
			FreezeScoreboardOnEnd: true,
		}
		assert.False(t, service.IsScoreboardFrozen())
	})

	t.Run("frozen when freezing is enabled and end date has elapsed", func(t *testing.T) {
		service := newService()
		past := time.Now().Add(-1 * time.Hour)
		service.currentNotification = &b.Notification{
			EndDate:               &past,
			FreezeScoreboardOnEnd: true,
		}
		assert.True(t, service.IsScoreboardFrozen())
	})
}

func TestSetEndDatePersistsFreezeFlag(t *testing.T) {
	t.Run("persists the freeze flag alongside the end date", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		endDate := time.Now().Add(2 * time.Hour)
		err := service.SetEndDate(context.Background(), &endDate, true)
		assert.Nil(t, err)

		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			context.Background(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)

		var stored b.Notification
		assert.Nil(t, json.Unmarshal([]byte(cm.Data["notification.json"]), &stored))
		assert.True(t, stored.FreezeScoreboardOnEnd)
		assert.NotNil(t, stored.EndDate)
	})

	t.Run("preserves the freeze flag when updating the message", func(t *testing.T) {
		clientset := fake.NewClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		service := NewNotificationService(bundle)

		endDate := time.Now().Add(2 * time.Hour)
		assert.Nil(t, service.SetEndDate(context.Background(), &endDate, true))
		assert.Nil(t, service.SetNotification(context.Background(), "hello", true))

		cm, err := clientset.CoreV1().ConfigMaps(bundle.RuntimeEnvironment.Namespace).Get(
			context.Background(),
			"multi-juicer-notification",
			metav1.GetOptions{},
		)
		assert.Nil(t, err)

		var stored b.Notification
		assert.Nil(t, json.Unmarshal([]byte(cm.Data["notification.json"]), &stored))
		assert.Equal(t, "hello", stored.Message)
		assert.True(t, stored.FreezeScoreboardOnEnd)
	})
}
