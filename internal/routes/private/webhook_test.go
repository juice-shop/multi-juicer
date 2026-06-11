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
		rr := httptest.NewRecorder()

		NewSolutionsWebhookHandler(b).ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)

		deployment, err := clientset.AppsV1().Deployments(b.RuntimeEnvironment.Namespace).Get(req.Context(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.Nil(t, err)
		assert.Contains(t, deployment.Annotations["multi-juicer.owasp-juice.shop/challenges"], "newChallenge")
	})
}
