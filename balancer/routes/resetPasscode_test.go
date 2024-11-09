package routes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	"golang.org/x/crypto/bcrypt"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestResetPasscodeHandler(t *testing.T) {
	team := "foobar"

	t.Run("reset passcode updates the saved passcode of the deployment", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/teams/reset-passcode", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		initialPasscodeHash := "$2a$10$wnxvqClPk/13SbdowdJtu.2thGxrZe4qrsaVdTVUsYIrVVClhPMfS"

		clientset := fake.NewSimpleClientset(&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":          "[]",
					"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
					"multi-juicer.owasp-juice.shop/lastRequest":         "1729259667397",
					"multi-juicer.owasp-juice.shop/lastRequestReadable": "2024-10-18 13:55:18.08198884+0000 UTC m=+11.556786174",
					"multi-juicer.owasp-juice.shop/passcode":            initialPasscodeHash,
				},
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
				},
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas: 1,
			},
		})
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, rr.Code, http.StatusOK)

		updatedDeployment, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.Nil(t, err)
		assert.NotEqual(t, initialPasscodeHash, updatedDeployment.Annotations["multi-juicer.owasp-juice.shop/passcode"])

		var response ResetPasscodeResponse
		err = json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)
		assert.Equal(t, "Passcode reset successfully", response.Message)
		assert.NotEmpty(t, response.Passcode)
		assert.Len(t, response.Passcode, 8)

		updatedHash := updatedDeployment.Annotations["multi-juicer.owasp-juice.shop/passcode"]
		assert.Nil(t, bcrypt.CompareHashAndPassword([]byte(updatedHash), []byte(response.Passcode)), "Returned passcode should match the updated hash")
	})
	t.Run("reset passcode requries a signed team cookie", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/teams/reset-passcode", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, rr.Code, http.StatusUnauthorized)
		assert.Empty(t, clientset.Actions())
	})
}
