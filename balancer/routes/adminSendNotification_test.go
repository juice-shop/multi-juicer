package routes

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/bundle"
	"github.com/juice-shop/multi-juicer/balancer/pkg/notifications"
	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
)

func createTestBundle() *bundle.Bundle {
	return &bundle.Bundle{
		Config: &bundle.Config{CookieConfig: bundle.CookieConfig{Name: "team", SigningKey: "xyz", Secure: true}},
	}
}

func TestHandleCreateNotificationAdminSuccess(t *testing.T) {
	service := notifications.NewService()
	b := createTestBundle()

	handler := handleCreateNotification(service, b)

	payload := map[string]string{
		"team":    "team-1",
		"title":   "Test title",
		"message": "Hello world",
		"level":   "info",
	}

	body, _ := json.Marshal(payload)

	req := httptest.NewRequest(
		http.MethodPost,
		"/balancer/api/notifications",
		bytes.NewReader(body),
	)

	team, _ := signutil.Sign("admin", "xyz")

	req.AddCookie(&http.Cookie{
		Name:  "team",
		Value: team,
	})
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", rec.Code)
	}

	// Verify notification was added
	notifs, _ := service.GetCurrent("team-1")

	if len(notifs) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notifs))
	}

	n := notifs[0]

	if n.Title != "Test title" {
		t.Errorf("unexpected title: %s", n.Title)
	}
	if n.Message != "Hello world" {
		t.Errorf("unexpected message: %s", n.Message)
	}
	if n.Level != "info" {
		t.Errorf("unexpected level: %s", n.Level)
	}
	if n.Team != "team-1" {
		t.Errorf("unexpected team: %s", n.Team)
	}
	if time.Since(n.CreatedAt) > time.Second {
		t.Errorf("CreatedAt not set correctly")
	}
}

func TestHandleCreateNotificationUnauthorized(t *testing.T) {
	service := notifications.NewService()
	b := createTestBundle()

	handler := handleCreateNotification(service, b)

	req := httptest.NewRequest(
		http.MethodPost,
		"/balancer/api/notifications",
		bytes.NewReader([]byte(`{}`)),
	)

	team, _ := signutil.Sign("team-a", "xyz")

	req.AddCookie(&http.Cookie{
		Name:  "team",
		Value: team,
	})

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rec.Code)
	}

	notifs, _ := service.GetCurrent("team-1")
	if len(notifs) != 0 {
		t.Fatalf("notification should not be created")
	}
}

func TestHandleCreateNotificationInvalidPayload(t *testing.T) {
	service := notifications.NewService()
	b := createTestBundle()

	handler := handleCreateNotification(service, b)

	req := httptest.NewRequest(
		http.MethodPost,
		"/balancer/api/notifications",
		bytes.NewReader([]byte(`{invalid-json`)),
	)

	team, _ := signutil.Sign("admin", "xyz")

	req.AddCookie(&http.Cookie{
		Name:  "team",
		Value: team,
	})

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
}
