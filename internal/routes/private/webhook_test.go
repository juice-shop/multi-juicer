package private

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/internal/bundle"
	"github.com/juice-shop/multi-juicer/internal/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

const validSolutionBody = `{"solution":{"challenge":"scoreBoardChallenge","issuedOn":"2026-01-01T00:00:00Z"},"ctfFlag":"","issuer":{"hostName":"","os":"","appName":"","config":"","version":""}}`

// stubNotificationService is a minimal NotificationService implementation that lets
// tests control the scoreboard-frozen state.
type stubNotificationService struct {
	frozen bool
}

func (s *stubNotificationService) GetNotificationWithTimestamp() (*bundle.Notification, time.Time) {
	return nil, time.Time{}
}
func (s *stubNotificationService) WaitForUpdatesNewerThan(_ context.Context, _ time.Time) (*bundle.Notification, time.Time, bool) {
	return nil, time.Time{}, false
}
func (s *stubNotificationService) StartNotificationWatcher(_ context.Context) {}
func (s *stubNotificationService) SetNotification(_ context.Context, _ string, _ bool) error {
	return nil
}
func (s *stubNotificationService) SetEndDate(_ context.Context, _ *time.Time, _ bool) error {
	return nil
}
func (s *stubNotificationService) IsScoreboardFrozen() bool { return s.frozen }

func newJuiceShopDeployment(team, challengesAnnotation string) *appsv1.Deployment {
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("juiceshop-%s", team),
			Namespace: "test-namespace",
			Annotations: map[string]string{
				"multi-juicer.owasp-juice.shop/challenges": challengesAnnotation,
			},
		},
	}
}

func newTeamDeployment(team string) *appsv1.Deployment {
	return &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:        fmt.Sprintf("juiceshop-%s", team),
			Namespace:   "test-namespace",
			Annotations: map[string]string{},
			Labels: map[string]string{
				"app.kubernetes.io/name":    "juice-shop",
				"app.kubernetes.io/part-of": "multi-juicer",
				"team":                      team,
			},
		},
	}
}

func webhookBody(challenge string) []byte {
	return fmt.Appendf(nil, `{"solution":{"challenge":%q,"issuedOn":"2026-06-11T10:00:00Z"}}`, challenge)
}

func TestSolutionsWebhookHandlerFreezing(t *testing.T) {
	const team = "frozen-team"

	t.Run("ignores new solves when the scoreboard is frozen", func(t *testing.T) {
		clientset := fake.NewClientset(newJuiceShopDeployment(team, `[{"key":"scoreBoardChallenge","solvedAt":"2026-06-11T09:00:00Z"}]`))
		b := testutil.NewTestBundleWithCustomFakeClient(clientset)
		b.NotificationService = &stubNotificationService{frozen: true}

		req, _ := http.NewRequest("POST", fmt.Sprintf("/team/%s/webhook", team), bytes.NewBuffer(webhookBody("newChallenge")))
		req.SetPathValue("team", team)
		req.SetPathValue("sig", testutil.SignTestWebhookTeamname(team))
		rr := httptest.NewRecorder()

		NewSolutionsWebhookHandler(b).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		// The deployment's challenge annotation must be untouched: the new solve was ignored.
		deployment, err := clientset.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).Get(req.Context(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.Nil(t, err)
		assert.Equal(t, `[{"key":"scoreBoardChallenge","solvedAt":"2026-06-11T09:00:00Z"}]`, deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"])
	})

	t.Run("records new solves when the scoreboard is not frozen", func(t *testing.T) {
		clientset := fake.NewClientset(newJuiceShopDeployment(team, `[]`))
		b := testutil.NewTestBundleWithCustomFakeClient(clientset)
		b.NotificationService = &stubNotificationService{frozen: false}

		req, _ := http.NewRequest("POST", fmt.Sprintf("/team/%s/webhook", team), bytes.NewBuffer(webhookBody("newChallenge")))
		req.SetPathValue("team", team)
		req.SetPathValue("sig", testutil.SignTestWebhookTeamname(team))
		rr := httptest.NewRecorder()

		NewSolutionsWebhookHandler(b).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		deployment, err := clientset.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).Get(req.Context(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.Nil(t, err)
		assert.Contains(t, deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"], "newChallenge")
	})
}

func TestWebhookHandler_AcceptsValidSignature(t *testing.T) {
	team := "alpha"
	clientset := fake.NewClientset(newTeamDeployment(team))
	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	bundle.NotificationService = &stubNotificationService{}

	mux := http.NewServeMux()
	AddRoutes(context.Background(), mux, bundle)

	sig := testutil.SignTestWebhookTeamname(team)
	req := httptest.NewRequest("POST", fmt.Sprintf("/team/%s/webhook/%s", team, sig), bytes.NewBufferString(validSolutionBody))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusOK, rr.Code)

	// The challenge should have been recorded on the team deployment.
	deployment, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
	assert.NoError(t, err)
	assert.Contains(t, deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"], "scoreBoardChallenge")
}

func TestWebhookHandler_RejectsInvalidSignature(t *testing.T) {
	team := "alpha"
	clientset := fake.NewClientset(newTeamDeployment(team))
	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	bundle.NotificationService = &stubNotificationService{}

	mux := http.NewServeMux()
	AddRoutes(context.Background(), mux, bundle)

	req := httptest.NewRequest("POST", fmt.Sprintf("/team/%s/webhook/%s", team, "deadbeef"), bytes.NewBufferString(validSolutionBody))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)

	// And no annotation should have been touched.
	deployment, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
	assert.NoError(t, err)
	assert.NotContains(t, deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"], "scoreBoardChallenge")
}

// Cross-team forgery: a Juice Shop with RCE in team "alpha" knows its own
// signature but cannot derive a valid one for team "beta".
func TestWebhookHandler_RejectsCrossTeamForgery(t *testing.T) {
	clientset := fake.NewClientset(newTeamDeployment("alpha"), newTeamDeployment("beta"))
	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	bundle.NotificationService = &stubNotificationService{}

	mux := http.NewServeMux()
	AddRoutes(context.Background(), mux, bundle)

	alphaSig := testutil.SignTestWebhookTeamname("alpha")
	req := httptest.NewRequest("POST", fmt.Sprintf("/team/%s/webhook/%s", "beta", alphaSig), bytes.NewBufferString(validSolutionBody))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)

	assert.Equal(t, http.StatusUnauthorized, rr.Code)

	beta, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), "juiceshop-beta", metav1.GetOptions{})
	assert.NoError(t, err)
	assert.NotContains(t, beta.Annotations["multi-juicer.owasp-juice.shop/challenges"], "scoreBoardChallenge")
}

func TestWebhookHandler_OldUnsignedPathDoesNotPersistSolves(t *testing.T) {
	team := "alpha"
	clientset := fake.NewClientset(newTeamDeployment(team))
	bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
	bundle.NotificationService = &stubNotificationService{}

	mux := http.NewServeMux()
	AddRoutes(context.Background(), mux, bundle)

	// The pre-fix URL (no signature segment) must not be reachable as a webhook —
	// our route only matches /team/{team}/webhook/{sig}. We don't care whether the
	// fall-through is 404 or the LLM gateway's 501; we care that the team's
	// challenges annotation is untouched.
	req := httptest.NewRequest("POST", fmt.Sprintf("/team/%s/webhook", team), bytes.NewBufferString(validSolutionBody))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	assert.NotEqual(t, http.StatusOK, rr.Code)

	deployment, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
	assert.NoError(t, err)
	assert.NotContains(t, deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"], "scoreBoardChallenge")
}
