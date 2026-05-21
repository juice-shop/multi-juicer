package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestRequireJSONContentType(t *testing.T) {
	called := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	})
	handler := RequireJSONContentType(next)

	cases := []struct {
		name        string
		contentType string
		wantStatus  int
		wantCalled  bool
	}{
		{"accepts application/json", "application/json", http.StatusOK, true},
		{"accepts application/json with charset", "application/json; charset=utf-8", http.StatusOK, true},
		{"accepts uppercase", "APPLICATION/JSON", http.StatusOK, true},
		{"rejects missing Content-Type", "", http.StatusUnsupportedMediaType, false},
		{"rejects text/plain", "text/plain", http.StatusUnsupportedMediaType, false},
		{"rejects form-urlencoded", "application/x-www-form-urlencoded", http.StatusUnsupportedMediaType, false},
		{"rejects multipart", "multipart/form-data; boundary=----foo", http.StatusUnsupportedMediaType, false},
		{"rejects malformed Content-Type", "this is not a media type", http.StatusUnsupportedMediaType, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			called = false
			req := httptest.NewRequest("POST", "/", nil)
			if tc.contentType != "" {
				req.Header.Set("Content-Type", tc.contentType)
			}
			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			assert.Equal(t, tc.wantStatus, rr.Code)
			assert.Equal(t, tc.wantCalled, called)
		})
	}
}
