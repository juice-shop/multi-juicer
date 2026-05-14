package private

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/progresswatchdog"
	"github.com/juice-shop/multi-juicer/internal/signutil"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type juiceShopWebhookSolution struct {
	Challenge       string   `json:"challenge"`
	Evidence        *string  `json:"evidence"`
	IssuedOn        string   `json:"issuedOn"`
	CheatScore      *float64 `json:"cheatScore"`
	TotalCheatScore *float64 `json:"totalCheatScore"`
}

type juiceShopWebhookIssuer struct {
	HostName string `json:"hostName"`
	Os       string `json:"os"`
	AppName  string `json:"appName"`
	Config   string `json:"config"`
	Version  string `json:"version"`
}

type juiceShopWebhook struct {
	Solution juiceShopWebhookSolution `json:"solution"`
	CtfFlag  string                   `json:"ctfFlag"`
	Issuer   juiceShopWebhookIssuer   `json:"issuer"`
}

// NewSolutionsWebhookHandler returns the handler that JuiceShop instances call when a challenge is solved.
// It's safe to register this on every replica: PersistProgress patches deployment annotations idempotently
// and an early "challenge already solved?" check makes duplicate webhooks no-ops.
func NewSolutionsWebhookHandler(b *bundle.Bundle) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		team := r.PathValue("team")

		// Validate the per-team bearer token to prevent cross-team credit injection.
		// The token is HMAC(team, signingKey), deterministically generated at deploy time
		// and injected into each JuiceShop pod as SOLUTIONS_WEBHOOK_TOKEN.
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "missing or invalid authorization header", http.StatusUnauthorized)
			return
		}
		tokenFromHeader := strings.TrimPrefix(authHeader, "Bearer ")
		claimedTeam, err := signutil.Unsign(tokenFromHeader, b.Config.CookieConfig.SigningKey)
		if err != nil || claimedTeam != team {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		var webhook juiceShopWebhook
		if err := json.NewDecoder(r.Body).Decode(&webhook); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		deployment, err := b.ClientSet.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).Get(ctx, fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		if err != nil {
			b.Log.Error("failed to get deployment for team received via webhook", "team", team, "error", err)
			http.Error(w, "deployment lookup failed", http.StatusInternalServerError)
			return
		}

		challengeStatusJson := "[]"
		if value, ok := deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"]; ok {
			challengeStatusJson = value
		}

		challengeStatus := make(progresswatchdog.ChallengeStatuses, 0)
		if err := json.Unmarshal([]byte(challengeStatusJson), &challengeStatus); err != nil {
			b.Log.Error("failed to decode json from juice shop deployment annotation", "error", err)
		}

		cheatScoresJson := "[]"
		if value, ok := deployment.Annotations["multi-juicer.owasp-juice.shop/cheatScores"]; ok {
			cheatScoresJson = value
		}

		cheatScores := make([]progresswatchdog.CheatScoreEntry, 0)
		if err := json.Unmarshal([]byte(cheatScoresJson), &cheatScores); err != nil {
			b.Log.Error("failed to decode cheat scores from juice shop deployment annotation", "error", err)
			cheatScores = make([]progresswatchdog.CheatScoreEntry, 0)
		}

		for _, status := range challengeStatus {
			if status.Key == webhook.Solution.Challenge {
				b.Log.Info("Challenge already solved, ignoring webhook", "challenge", webhook.Solution.Challenge, "team", team)
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("ok"))
				return
			}
		}

		solvedAtTime, err := time.Parse(time.RFC3339, webhook.Solution.IssuedOn)
		if err != nil {
			b.Log.Warn("Failed to parse timestamp, using current time in UTC", "timestamp", webhook.Solution.IssuedOn, "error", err)
			solvedAtTime = time.Now().UTC()
		}
		solvedAtUTC := solvedAtTime.UTC().Format(time.RFC3339)

		challengeStatus = append(challengeStatus, progresswatchdog.ChallengeStatus{
			Key:      webhook.Solution.Challenge,
			SolvedAt: solvedAtUTC,
		})
		sort.Stable(challengeStatus)

		if webhook.Solution.TotalCheatScore != nil {
			cheatScores = append(cheatScores, progresswatchdog.CheatScoreEntry{
				TotalCheatScore: *webhook.Solution.TotalCheatScore,
				Timestamp:       solvedAtUTC,
			})
		}

		progresswatchdog.PersistProgress(ctx, b, team, challengeStatus, cheatScores)

		b.Log.Info("Received webhook", "team", team, "challenge", webhook.Solution.Challenge)

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}
}
