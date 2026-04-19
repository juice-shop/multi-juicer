package llmgateway

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/juice-shop/multi-juicer/balancer/pkg/signutil"
)

// openAIResponse is a minimal representation of an OpenAI chat completion response for usage extraction.
type openAIResponse struct {
	Usage *openAIUsage `json:"usage,omitempty"`
}

type openAIUsage struct {
	InputTokens  int64 `json:"prompt_tokens"`
	OutputTokens int64 `json:"completion_tokens"`
}

// Gateway proxies LLM requests from JuiceShop instances to an upstream LLM API.
type Gateway struct {
	signingKey  string
	upstreamURL *url.URL
	apiKey      string
	usage       *UsageTracker
	logger      *slog.Logger
}

// NewGateway creates a new LLM gateway.
func NewGateway(signingKey string, upstreamURL string, apiKey string, usage *UsageTracker, logger *slog.Logger) (*Gateway, error) {
	u, err := url.Parse(upstreamURL)
	if err != nil {
		return nil, err
	}
	return &Gateway{
		signingKey:  signingKey,
		upstreamURL: u,
		apiKey:      apiKey,
		usage:       usage,
		logger:      logger,
	}, nil
}

func (g *Gateway) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// Extract bearer token
	authHeader := r.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		http.Error(w, `{"error":"missing or invalid Authorization header"}`, http.StatusUnauthorized)
		return
	}
	teamToken := strings.TrimPrefix(authHeader, "Bearer ")

	// Validate token by verifying the HMAC signature and extracting the team name
	team, err := signutil.Unsign(teamToken, g.signingKey)
	if err != nil {
		http.Error(w, `{"error":"invalid token"}`, http.StatusUnauthorized)
		return
	}

	// Check if this is a chat completions request (for usage tracking)
	isChatCompletion := strings.Contains(r.URL.Path, "/chat/completions")
	g.logger.Debug("LLM gateway: request", "team", team, "method", r.Method, "path", r.URL.Path, "isChatCompletion", isChatCompletion)

	// Create reverse proxy
	proxy := &httputil.ReverseProxy{
		Rewrite: func(pr *httputil.ProxyRequest) {
			pr.SetURL(g.upstreamURL)
			pr.Out.Host = g.upstreamURL.Host
			// Replace the authorization header with the real API key
			pr.Out.Header.Set("Authorization", "Bearer "+g.apiKey)
		},
	}

	if isChatCompletion {
		proxy.ModifyResponse = func(resp *http.Response) error {
			return g.extractUsage(resp, team)
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		g.logger.Error("LLM gateway proxy error", "team", team, "error", err)
		http.Error(w, `{"error":"upstream LLM API error"}`, http.StatusBadGateway)
	}

	proxy.ServeHTTP(w, r)
}

func (g *Gateway) extractUsage(resp *http.Response, team string) error {
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}

	contentType := resp.Header.Get("Content-Type")
	isSSE := strings.Contains(contentType, "text/event-stream")

	body, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		g.logger.Error("LLM gateway: failed to read response body", "team", team, "error", err)
		resp.Body = io.NopCloser(bytes.NewReader(body))
		return nil
	}

	// Restore the body for the client
	resp.Body = io.NopCloser(bytes.NewReader(body))

	if isSSE {
		g.extractUsageFromSSE(body, team)
	} else {
		g.extractUsageFromJSON(body, team)
	}
	return nil
}

func (g *Gateway) extractUsageFromJSON(body []byte, team string) {
	var result openAIResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return
	}
	if result.Usage != nil {
		g.logger.Debug("LLM gateway: usage", "team", team, "input_tokens", result.Usage.InputTokens, "output_tokens", result.Usage.OutputTokens)
		g.usage.Add(team, result.Usage.InputTokens, result.Usage.OutputTokens)
	}
}

// extractUsageFromSSE scans SSE events for usage data, which typically appears in the last chunk.
func (g *Gateway) extractUsageFromSSE(body []byte, team string) {
	// SSE format: lines starting with "data: " contain JSON payloads
	// Scan all data lines for usage (it's usually in the last real chunk before "data: [DONE]")
	lines := strings.Split(string(body), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		payload := strings.TrimPrefix(line, "data: ")
		if payload == "[DONE]" {
			continue
		}
		var chunk openAIResponse
		if err := json.Unmarshal([]byte(payload), &chunk); err != nil {
			continue
		}
		if chunk.Usage != nil {
			g.logger.Debug("LLM gateway: SSE usage", "team", team, "input_tokens", chunk.Usage.InputTokens, "output_tokens", chunk.Usage.OutputTokens)
			g.usage.Add(team, chunk.Usage.InputTokens, chunk.Usage.OutputTokens)
			return
		}
	}
	g.logger.Debug("LLM gateway: no usage data found in SSE stream", "team", team)
}
