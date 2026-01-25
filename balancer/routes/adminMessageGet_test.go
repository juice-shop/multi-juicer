package routes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/adminmessage"
	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
)

func TestHandleGetAdminMessageImmediate(t *testing.T) {
	svc := adminmessage.NewService()
	bundle := testutil.NewTestBundle()

	svc.Set(&adminmessage.Message{
		Text:      "Hello",
		UpdatedAt: time.Now().UTC(),
	})

	handler := handleGetAdminMessage(svc, bundle)

	req := httptest.NewRequest(
		http.MethodGet,
		"/balancer/api/admin-message",
		nil,
	)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200")
	}
}

func TestHandleGetAdminMessageNoUpdate(t *testing.T) {
	svc := adminmessage.NewService()
	bundle := testutil.NewTestBundle()
	handler := handleGetAdminMessage(svc, bundle)

	req := httptest.NewRequest(
		http.MethodGet,
		"/balancer/api/admin-message?wait-for-update-after="+
			time.Now().Format(time.RFC3339),
		nil,
	)

	ctx, cancel := context.WithTimeout(req.Context(), 50*time.Millisecond)
	defer cancel()

	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Fatalf("expected 204")
	}
}
