package private

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/internal/signutil"
	"github.com/juice-shop/multi-juicer/internal/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func webhookPayload(t *testing.T, challenge string) *bytes.Buffer {
	t.Helper()
	payload, _ := json.Marshal(juiceShopWebhook{
		Solution: juiceShopWebhookSolution{
			Challenge:  challenge,
			IssuedOn:   "2024-01-01T00:00:00Z",
		},
	})
	return bytes.NewBuffer(payload)
}

func validTokenForTeam(team string) string {
	signed, err := signutil.Sign(team, "test-signing-key")
	if err != nil {
		panic(err)
	}
	return signed
}

func teamDeployment(team string) *appsv1.Deployment {
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("juiceshop-%s", team),
			Namespace: "test-namespace",
			Annotations: map[string]string{
				"multi-juicer.owasp-juice.shop/challenges":       "[]",
				"multi-juicer.owasp-juice.shop/challengesSolved": "0",
				"multi-juicer.owasp-juice.shop/cheatScores":      "[]",
			},
		},
	}
}

func TestWebhookAuthorizationChecks(t *testing.T) {
	team := "foobar"

	t.Run("rejects request with no Authorization header", func(t *testing.T) {
		b := testutil.NewTestBundle()
		req, _ := http.NewRequest("POST", fmt.Sprintf("/team/%s/webhook", team), webhookPayload(t, "xssChallenge"))
		req.SetPathValue("team", team)
		rr := httptest.NewRecorder()
		NewSolutionsWebhookHandler(b)(rr, req)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("rejects request with invalid Bearer token", func(t *testing.T) {
		b := testutil.NewTestBundle()
		req, _ := http.NewRequest("POST", fmt.Sprintf("/team/%s/webhook", team), webhookPayload(t, "xssChallenge"))
		req.SetPathValue("team", team)
		req.Header.Set("Authorization", "Bearer totallyinvalidtoken")
		rr := httptest.NewRecorder()
		NewSolutionsWebhookHandler(b)(rr, req)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("rejects request with token belonging to a different team", func(t *testing.T) {
		b := testutil.NewTestBundle()
		otherTeamToken := validTokenForTeam("otherteam")
		req, _ := http.NewRequest("POST", fmt.Sprintf("/team/%s/webhook", team), webhookPayload(t, "xssChallenge"))
		req.SetPathValue("team", team)
		req.Header.Set("Authorization", "Bearer "+otherTeamToken)
		rr := httptest.NewRecorder()
		NewSolutionsWebhookHandler(b)(rr, req)
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
	})

	t.Run("accepts request with correct per-team Bearer token", func(t *testing.T) {
		clientset := fake.NewClientset(teamDeployment(team))
		b := testutil.NewTestBundleWithCustomFakeClient(clientset)
		token := validTokenForTeam(team)

		req, _ := http.NewRequest("POST", fmt.Sprintf("/team/%s/webhook", team), webhookPayload(t, "xssChallenge"))
		req.SetPathValue("team", team)
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()
		NewSolutionsWebhookHandler(b)(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)
	})
}
