package routes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/notifications"
)

func newRequest(team string, url string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, url, nil)
	if team != "" {
		req.AddCookie(&http.Cookie{
			Name:  "team",
			Value: team,
		})
	}
	return req
}

func TestGetNotificationsInitialFetch(t *testing.T) {
	service := notifications.NewService()
	bundle := createTestBundle()

	handler := handleGetNotifications(bundle, service)

	service.Add(notifications.Notification{
		Team:      "team-1",
		Title:     "Hello",
		Message:   "World",
		Level:     "info",
		CreatedAt: time.Now().UTC(),
	})

	req := newRequest("team-1", "/balancer/api/notifications")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var out []notifications.Notification
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}

	if len(out) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(out))
	}
}

func TestGetNotificationsLongPollTimeout(t *testing.T) {
	service := notifications.NewService()
	bundle := createTestBundle()

	handler := handleGetNotifications(bundle, service)

	ts := time.Now().UTC().Format(time.RFC3339)
	req := newRequest(
		"team-1",
		"/balancer/api/notifications?wait-for-update-after="+ts,
	)

	rec := httptest.NewRecorder()

	start := time.Now()
	handler.ServeHTTP(rec, req)
	elapsed := time.Since(start)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rec.Code)
	}

	// sanity check: should not return immediately
	if elapsed < 20*time.Millisecond {
		t.Fatalf("long poll returned too fast")
	}
}

func TestGetNotificationsLongPollReceivesUpdate(t *testing.T) {
	service := notifications.NewService()
	bundle := createTestBundle()

	handler := handleGetNotifications(bundle, service)

	lastSeen := time.Now().UTC()

	req := newRequest(
		"team-1",
		"/balancer/api/notifications?wait-for-update-after="+lastSeen.Format(time.RFC3339),
	)

	rec := httptest.NewRecorder()

	done := make(chan struct{})

	go func() {
		handler.ServeHTTP(rec, req)
		close(done)
	}()

	// simulate async notification
	time.Sleep(20 * time.Millisecond)
	service.Add(notifications.Notification{
		Team:      "team-1",
		Title:     "Update",
		Message:   "New message",
		Level:     "info",
		CreatedAt: time.Now().UTC(),
	})

	select {
	case <-done:
	case <-time.After(1 * time.Second):
		t.Fatal("long poll did not unblock")
	}

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var out []notifications.Notification
	if err := json.NewDecoder(rec.Body).Decode(&out); err != nil {
		t.Fatal(err)
	}

	if len(out) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(out))
	}
}

func TestGetNotificationsTeamFiltering(t *testing.T) {
	service := notifications.NewService()
	bundle := createTestBundle()

	handler := handleGetNotifications(bundle, service)

	service.Add(notifications.Notification{
		Team:      "",
		Title:     "Global",
		Message:   "Everyone sees this",
		Level:     "info",
		CreatedAt: time.Now().UTC(),
	})

	service.Add(notifications.Notification{
		Team:      "team-1",
		Title:     "Private",
		Message:   "Only team-1",
		Level:     "warn",
		CreatedAt: time.Now().UTC(),
	})

	req := newRequest("team-1", "/balancer/api/notifications")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	var out []notifications.Notification
	json.NewDecoder(rec.Body).Decode(&out)

	if len(out) != 2 {
		t.Fatalf("expected 2 notifications, got %d", len(out))
	}
}
