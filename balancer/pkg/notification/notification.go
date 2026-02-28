package notification

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/timeutil"
	corev1 "k8s.io/api/core/v1"
	"k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
)

type NotificationService struct {
	bundle              *bundle.Bundle
	currentNotification *bundle.Notification
	mutex               *sync.RWMutex
	lastUpdate          time.Time
}

func NewNotificationService(b *bundle.Bundle) *NotificationService {
	return &NotificationService{
		bundle:              b,
		currentNotification: nil,
		mutex:               &sync.RWMutex{},
		lastUpdate:          timeutil.TruncateToMillisecond(time.Now()),
	}
}

func (s *NotificationService) GetNotificationWithTimestamp() (*bundle.Notification, time.Time) {
	s.mutex.RLock()
	defer s.mutex.RUnlock()

	// Return nil if notification is disabled or doesn't exist
	if s.currentNotification == nil || !s.currentNotification.Enabled {
		return nil, s.lastUpdate
	}

	return s.currentNotification, s.lastUpdate
}

func (s *NotificationService) WaitForUpdatesNewerThan(ctx context.Context, lastSeenUpdate time.Time) (*bundle.Notification, time.Time, bool) {
	// Fast path: check if we already have newer data
	s.mutex.RLock()
	if s.lastUpdate.After(lastSeenUpdate) {
		notification := s.currentNotification
		lastUpdate := s.lastUpdate
		s.mutex.RUnlock()

		// Return nil if disabled
		if notification == nil || !notification.Enabled {
			return nil, lastUpdate, true
		}
		return notification, lastUpdate, true
	}
	s.mutex.RUnlock()

	// Slow path: poll for updates
	const maxWaitTime = 25 * time.Second
	timeout := time.NewTimer(maxWaitTime)
	ticker := time.NewTicker(50 * time.Millisecond)
	defer timeout.Stop()
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.mutex.RLock()
			if s.lastUpdate.After(lastSeenUpdate) {
				notification := s.currentNotification
				lastUpdate := s.lastUpdate
				s.mutex.RUnlock()

				// Return nil if disabled
				if notification == nil || !notification.Enabled {
					return nil, lastUpdate, true
				}
				return notification, lastUpdate, true
			}
			s.mutex.RUnlock()
		case <-timeout.C:
			// Timeout reached, no updates
			return nil, time.Time{}, false
		case <-ctx.Done():
			// Context canceled
			return nil, time.Time{}, false
		}
	}
}

func (s *NotificationService) StartNotificationWatcher(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			s.bundle.Log.Printf("MultiJuicer context canceled. Exiting notification watcher.")
			return
		default:
			s.watchConfigMap(ctx)
			// Wait before reconnecting
			time.Sleep(5 * time.Second)
		}
	}
}

func (s *NotificationService) watchConfigMap(ctx context.Context) {
	const configMapName = "multi-juicer-notification"

	// Initial fetch
	configMap, err := s.bundle.ClientSet.CoreV1().ConfigMaps(s.bundle.RuntimeEnvironment.Namespace).Get(
		ctx,
		configMapName,
		metav1.GetOptions{},
	)
	if err != nil {
		if errors.IsNotFound(err) {
			s.bundle.Log.Printf("Notification ConfigMap not found. Treating as no notification.")
			s.parseAndUpdateNotification(nil)
		} else {
			s.bundle.Log.Printf("Failed to get notification ConfigMap: %v", err)
			return
		}
	} else {
		s.parseAndUpdateNotification(configMap)
	}

	// Start watching
	watcher, err := s.bundle.ClientSet.CoreV1().ConfigMaps(s.bundle.RuntimeEnvironment.Namespace).Watch(
		ctx,
		metav1.ListOptions{
			FieldSelector: "metadata.name=" + configMapName,
		},
	)
	if err != nil {
		s.bundle.Log.Printf("Failed to start watch for notification ConfigMap: %v", err)
		return
	}
	defer watcher.Stop()

	s.bundle.Log.Printf("Started watching notification ConfigMap")

	for {
		select {
		case event, ok := <-watcher.ResultChan():
			if !ok {
				s.bundle.Log.Printf("Notification ConfigMap watcher closed. Reconnecting...")
				return
			}

			switch event.Type {
			case watch.Added, watch.Modified:
				configMap := event.Object.(*corev1.ConfigMap)
				s.parseAndUpdateNotification(configMap)
			case watch.Deleted:
				s.bundle.Log.Printf("Notification ConfigMap deleted")
				s.parseAndUpdateNotification(nil)
			}
		case <-ctx.Done():
			s.bundle.Log.Printf("Context canceled. Exiting notification watcher.")
			return
		}
	}
}

func (s *NotificationService) parseAndUpdateNotification(cm *corev1.ConfigMap) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	if cm == nil {
		s.currentNotification = nil
		s.lastUpdate = timeutil.TruncateToMillisecond(time.Now())
		return
	}

	jsonData, ok := cm.Data["notification.json"]
	if !ok {
		s.bundle.Log.Printf("Notification ConfigMap missing 'notification.json' key")
		s.currentNotification = nil
		s.lastUpdate = timeutil.TruncateToMillisecond(time.Now())
		return
	}

	var notification bundle.Notification
	if err := json.Unmarshal([]byte(jsonData), &notification); err != nil {
		s.bundle.Log.Printf("Failed to parse notification JSON: %v", err)
		s.currentNotification = nil
		s.lastUpdate = timeutil.TruncateToMillisecond(time.Now())
		return
	}

	s.currentNotification = &notification
	s.lastUpdate = timeutil.TruncateToMillisecond(time.Now())
	s.bundle.Log.Printf("Updated notification: enabled=%v, message=%q", notification.Enabled, notification.Message)
}

// getOrCreateConfigMap retrieves the existing notification ConfigMap or returns a new empty one.
// The boolean indicates whether the ConfigMap already existed.
func (s *NotificationService) getOrCreateConfigMap(ctx context.Context) (*corev1.ConfigMap, bool, error) {
	const configMapName = "multi-juicer-notification"

	existingCM, err := s.bundle.ClientSet.CoreV1().ConfigMaps(s.bundle.RuntimeEnvironment.Namespace).Get(
		ctx,
		configMapName,
		metav1.GetOptions{},
	)
	if err != nil {
		if errors.IsNotFound(err) {
			return &corev1.ConfigMap{
				ObjectMeta: metav1.ObjectMeta{
					Name:      configMapName,
					Namespace: s.bundle.RuntimeEnvironment.Namespace,
				},
				Data: map[string]string{},
			}, false, nil
		}
		return nil, false, err
	}
	return existingCM, true, nil
}

// readNotification parses the existing notification from a ConfigMap, returning a zero-value Notification if missing/invalid.
func (s *NotificationService) readNotification(cm *corev1.ConfigMap) bundle.Notification {
	if cm.Data == nil {
		return bundle.Notification{}
	}
	jsonData, ok := cm.Data["notification.json"]
	if !ok {
		return bundle.Notification{}
	}
	var n bundle.Notification
	if err := json.Unmarshal([]byte(jsonData), &n); err != nil {
		return bundle.Notification{}
	}
	return n
}

// saveConfigMap creates or updates the ConfigMap with the given notification data.
func (s *NotificationService) saveConfigMap(ctx context.Context, cm *corev1.ConfigMap, existed bool, data bundle.Notification) error {
	notificationJSON, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if cm.Data == nil {
		cm.Data = make(map[string]string)
	}
	cm.Data["notification.json"] = string(notificationJSON)

	if existed {
		_, err = s.bundle.ClientSet.CoreV1().ConfigMaps(s.bundle.RuntimeEnvironment.Namespace).Update(ctx, cm, metav1.UpdateOptions{})
	} else {
		_, err = s.bundle.ClientSet.CoreV1().ConfigMaps(s.bundle.RuntimeEnvironment.Namespace).Create(ctx, cm, metav1.CreateOptions{})
	}
	return err
}

// SetNotification updates or creates the notification ConfigMap, preserving the existing endDate.
func (s *NotificationService) SetNotification(ctx context.Context, message string, enabled bool) error {
	cm, existed, err := s.getOrCreateConfigMap(ctx)
	if err != nil {
		return err
	}

	existing := s.readNotification(cm)

	notificationData := bundle.Notification{
		Message:   message,
		Enabled:   enabled,
		UpdatedAt: timeutil.TruncateToMillisecond(time.Now()),
		EndDate:   existing.EndDate,
	}

	return s.saveConfigMap(ctx, cm, existed, notificationData)
}

// SetEndDate updates or creates the notification ConfigMap, preserving the existing message and enabled fields.
func (s *NotificationService) SetEndDate(ctx context.Context, endDate *time.Time) error {
	cm, existed, err := s.getOrCreateConfigMap(ctx)
	if err != nil {
		return err
	}

	existing := s.readNotification(cm)

	notificationData := bundle.Notification{
		Message:   existing.Message,
		Enabled:   existing.Enabled,
		UpdatedAt: timeutil.TruncateToMillisecond(time.Now()),
		EndDate:   endDate,
	}

	return s.saveConfigMap(ctx, cm, existed, notificationData)
}
