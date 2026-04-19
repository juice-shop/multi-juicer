package llmgateway

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
)

const testSigningKey = "test-secret-key"

func signToken(team string) string {
	token, _ := signutil.Sign(team, testSigningKey)
	return token
}

func TestGateway_MissingAuth(t *testing.T) {
	usage := NewUsageTracker()
	gw, _ := NewGateway(testSigningKey, "http://localhost:11434", "real-key", usage, slog.New(slog.NewTextHandler(os.Stdout, nil)))

	req := httptest.NewRequest("POST", "/v1/chat/completions", nil)
	w := httptest.NewRecorder()
	gw.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestGateway_InvalidToken(t *testing.T) {
	usage := NewUsageTracker()
	gw, _ := NewGateway(testSigningKey, "http://localhost:11434", "real-key", usage, slog.New(slog.NewTextHandler(os.Stdout, nil)))

	req := httptest.NewRequest("POST", "/v1/chat/completions", nil)
	req.Header.Set("Authorization", "Bearer bad-token")
	w := httptest.NewRecorder()
	gw.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestGateway_ProxiesWithRealKey(t *testing.T) {
	var receivedAuth string
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{
			"choices": []map[string]any{},
			"usage": map[string]any{
				"prompt_tokens":     10,
				"completion_tokens": 20,
			},
		})
	}))
	defer upstream.Close()

	usage := NewUsageTracker()
	gw, _ := NewGateway(testSigningKey, upstream.URL, "real-api-key", usage, slog.New(slog.NewTextHandler(os.Stdout, nil)))

	req := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"test","messages":[]}`))
	req.Header.Set("Authorization", "Bearer "+signToken("team-a"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	gw.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	if receivedAuth != "Bearer real-api-key" {
		t.Errorf("expected upstream to receive real API key, got %s", receivedAuth)
	}

	// Check usage was tracked
	usage.mu.Lock()
	u, ok := usage.usage["team-a"]
	usage.mu.Unlock()
	if !ok {
		t.Fatal("expected usage for team-a")
	}
	if u.InputTokens != 10 || u.OutputTokens != 20 {
		t.Errorf("expected 10/20 tokens, got %d/%d", u.InputTokens, u.OutputTokens)
	}
}

func TestGateway_NonCompletionEndpoint_NoUsageTracking(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"models":[]}`))
	}))
	defer upstream.Close()

	usage := NewUsageTracker()
	gw, _ := NewGateway(testSigningKey, upstream.URL, "real-api-key", usage, slog.New(slog.NewTextHandler(os.Stdout, nil)))

	req := httptest.NewRequest("GET", "/v1/models", nil)
	req.Header.Set("Authorization", "Bearer "+signToken("team-a"))
	w := httptest.NewRecorder()
	gw.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	// No usage should be tracked for non-completion endpoints
	usage.mu.Lock()
	_, ok := usage.usage["team-a"]
	usage.mu.Unlock()
	if ok {
		t.Error("expected no usage tracking for non-completion endpoint")
	}
}

func TestGateway_ResponseBodyPassedThrough(t *testing.T) {
	expectedBody := `{"id":"chatcmpl-123","choices":[{"message":{"content":"Hello!"}}],"usage":{"prompt_tokens":5,"completion_tokens":3}}`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(expectedBody))
	}))
	defer upstream.Close()

	usage := NewUsageTracker()
	gw, _ := NewGateway(testSigningKey, upstream.URL, "real-api-key", usage, slog.New(slog.NewTextHandler(os.Stdout, nil)))

	req := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"test","messages":[]}`))
	req.Header.Set("Authorization", "Bearer "+signToken("team-a"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	gw.ServeHTTP(w, req)

	body, _ := io.ReadAll(w.Body)
	if string(body) != expectedBody {
		t.Errorf("response body not passed through correctly.\nexpected: %s\ngot: %s", expectedBody, string(body))
	}
}

func TestGateway_SSEStream_UsageTracking(t *testing.T) {
	sseBody := `: comment
data: {"id":"1","object":"chat.completion.chunk","choices":[{"delta":{"content":"Hi"}}]}

data: {"id":"1","object":"chat.completion.chunk","choices":[{"delta":{"content":"!"}}],"usage":{"prompt_tokens":15,"completion_tokens":25}}

data: [DONE]

`
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Write([]byte(sseBody))
	}))
	defer upstream.Close()

	usage := NewUsageTracker()
	gw, _ := NewGateway(testSigningKey, upstream.URL, "real-api-key", usage, slog.New(slog.NewTextHandler(os.Stdout, nil)))

	req := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"test","messages":[]}`))
	req.Header.Set("Authorization", "Bearer "+signToken("team-a"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	gw.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	usage.mu.Lock()
	u, ok := usage.usage["team-a"]
	usage.mu.Unlock()
	if !ok {
		t.Fatal("expected usage for team-a from SSE stream")
	}
	if u.InputTokens != 15 || u.OutputTokens != 25 {
		t.Errorf("expected 15/25 tokens, got %d/%d", u.InputTokens, u.OutputTokens)
	}
}
