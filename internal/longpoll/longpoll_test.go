package longpoll

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type testData struct {
	Value string
}

func TestHandleLongPoll_ImmediateResponse(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	fetchFunc := func(ctx context.Context, waitAfter *time.Time) (testData, time.Time, bool, error) {
		if waitAfter != nil {
			t.Error("Expected waitAfter to be nil for immediate request")
		}
		now := time.Now()
		return testData{Value: "test"}, now, true, nil
	}

	data, lastUpdate, statusCode, err := HandleLongPoll(req, fetchFunc)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if statusCode != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, statusCode)
	}
	if data.Value != "test" {
		t.Errorf("Expected data value 'test', got '%s'", data.Value)
	}
	if lastUpdate.IsZero() {
		t.Error("Expected lastUpdate to be set")
	}
}

func TestHandleLongPoll_WithWaitParameter(t *testing.T) {
	lastSeen := time.Now().UTC().Add(-5 * time.Minute)
	req := httptest.NewRequest(http.MethodGet, "/test?wait-for-update-after="+lastSeen.Format(time.RFC3339), nil)

	fetchFunc := func(ctx context.Context, waitAfter *time.Time) (testData, time.Time, bool, error) {
		if waitAfter == nil {
			t.Error("Expected waitAfter to be set")
		}
		// RFC3339 parsing truncates to second precision, so check within 1 second
		if waitAfter != nil && waitAfter.Truncate(time.Second) != lastSeen.Truncate(time.Second) {
			t.Errorf("Expected waitAfter to be %v, got %v", lastSeen, *waitAfter)
		}
		now := time.Now()
		return testData{Value: "updated"}, now, true, nil
	}

	data, _, statusCode, err := HandleLongPoll(req, fetchFunc)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if statusCode != http.StatusOK {
		t.Errorf("Expected status %d, got %d", http.StatusOK, statusCode)
	}
	if data.Value != "updated" {
		t.Errorf("Expected data value 'updated', got '%s'", data.Value)
	}
}

func TestHandleLongPoll_NoUpdatesAvailable(t *testing.T) {
	lastSeen := time.Now().UTC()
	req := httptest.NewRequest(http.MethodGet, "/test?wait-for-update-after="+lastSeen.Format(time.RFC3339), nil)

	fetchFunc := func(ctx context.Context, waitAfter *time.Time) (testData, time.Time, bool, error) {
		// Simulate no updates available
		return testData{}, time.Time{}, false, nil
	}

	_, _, statusCode, err := HandleLongPoll(req, fetchFunc)

	if err != nil {
		t.Errorf("Expected no error, got %v", err)
	}
	if statusCode != http.StatusNoContent {
		t.Errorf("Expected status %d, got %d", http.StatusNoContent, statusCode)
	}
}

func TestHandleLongPoll_InvalidTimestamp(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test?wait-for-update-after=invalid", nil)

	fetchFunc := func(ctx context.Context, waitAfter *time.Time) (testData, time.Time, bool, error) {
		t.Error("fetchFunc should not be called with invalid timestamp")
		return testData{}, time.Time{}, false, nil
	}

	_, _, statusCode, err := HandleLongPoll(req, fetchFunc)

	if err == nil {
		t.Error("Expected error for invalid timestamp")
	}
	if statusCode != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, statusCode)
	}
}

func TestHandleLongPoll_FetchError(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/test", nil)

	expectedErr := errors.New("fetch failed")
	fetchFunc := func(ctx context.Context, waitAfter *time.Time) (testData, time.Time, bool, error) {
		return testData{}, time.Time{}, false, expectedErr
	}

	_, _, statusCode, err := HandleLongPoll(req, fetchFunc)

	if err == nil {
		t.Error("Expected error to be returned")
	}
	if err != expectedErr {
		t.Errorf("Expected error %v, got %v", expectedErr, err)
	}
	if statusCode != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, statusCode)
	}
}

func TestHandleLongPoll_ContextCancellation(t *testing.T) {
	lastSeen := time.Now().UTC()
	req := httptest.NewRequest(http.MethodGet, "/test?wait-for-update-after="+lastSeen.Format(time.RFC3339), nil)
	ctx, cancel := context.WithCancel(req.Context())
	req = req.WithContext(ctx)

	fetchFunc := func(ctx context.Context, waitAfter *time.Time) (testData, time.Time, bool, error) {
		// Check that context is passed through
		if ctx.Err() != nil {
			return testData{}, time.Time{}, false, ctx.Err()
		}
		return testData{}, time.Time{}, false, nil
	}

	// Cancel context before calling
	cancel()

	_, _, statusCode, err := HandleLongPoll(req, fetchFunc)

	if err == nil {
		t.Error("Expected context cancellation error")
	}
	if statusCode != http.StatusInternalServerError {
		t.Errorf("Expected status %d, got %d", http.StatusInternalServerError, statusCode)
	}
}
