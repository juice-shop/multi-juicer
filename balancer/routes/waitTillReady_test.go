package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/client-go/kubernetes/fake"
	clientgotesting "k8s.io/client-go/testing"
)

func TestWaitTillReadyHandler(t *testing.T) {
	team := "foobar"

	t.Run("returns immediately when deployment is ready", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/teams/%s/wait-till-ready", team), nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:        fmt.Sprintf("juiceshop-%s", team),
				Namespace:   "test-namespace",
				Annotations: map[string]string{},
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

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Contains(t, "", rr.Body.String())
	})

	t.Run("returns a 404 if the team doesn't have a deployment", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/teams/%s/wait-till-ready", team), nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
		assert.Contains(t, rr.Body.String(), "team not found")
	})

	t.Run("returns a 401 if the balancer cookie isn't signed", func(t *testing.T) {
		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/teams/%s/wait-till-ready", team), nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", team))
		rr := httptest.NewRecorder()
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", strings.TrimSpace(rr.Body.String()))
	})

	t.Run("retries and waits until deployment becomes ready", func(t *testing.T) {
		team := "team-1"

		// Custom Kubernetes fake client to simulate the transition from pending to ready
		clientset := fake.NewSimpleClientset()

		calls := 0
		clientset.PrependReactor("get", "deployments", func(action clientgotesting.Action) (handled bool, ret runtime.Object, err error) {
			calls++
			readyReplicas := 0
			if calls >= 2 {
				readyReplicas = 1
			}
			return true, &appsv1.Deployment{
				ObjectMeta: metav1.ObjectMeta{
					Name:      fmt.Sprintf("juiceshop-%s", team),
					Namespace: "test-namespace",
					Labels: map[string]string{
						"app.kubernetes.io/name":    "juice-shop",
						"app.kubernetes.io/part-of": "multi-juicer",
					},
				},
				Status: appsv1.DeploymentStatus{
					ReadyReplicas: int32(readyReplicas),
				},
			}, nil
		})

		req, _ := http.NewRequest("GET", fmt.Sprintf("/balancer/api/teams/%s/wait-till-ready", team), nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname(team)))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		// Perform the request
		server.ServeHTTP(rr, req)

		// Ensure that the response code is 200 OK
		assert.Equal(t, http.StatusOK, rr.Code)
		assert.GreaterOrEqual(t, calls, 2)
	})
}
