package routes

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
)

func TestHandleSetAdminMessageAdminSuccess(t *testing.T) {

	b := testutil.NewTestBundle()

	handler := handleSetAdminMessage(b)

	body, _ := json.Marshal(map[string]string{
		"title":   "Hi",
		"message": "Test",
		"level":   "info",
	})

	req := httptest.NewRequest(
		http.MethodPost,
		"/balancer/api/admin-message",
		bytes.NewReader(body),
	)

	team, _ := signutil.Sign("admin", "test-signing-key")
	req.AddCookie(&http.Cookie{Name: "team", Value: team})

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rec.Code)
	}
}

func TestHandleSetAdminMessageUnauthorized(t *testing.T) {
	b := testutil.NewTestBundle()

	handler := handleSetAdminMessage(b)

	req := httptest.NewRequest(
		http.MethodPost,
		"/balancer/api/admin-message",
		nil,
	)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401")
	}
}
