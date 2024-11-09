package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAdminDeleteInstanceHandler(t *testing.T) {
	createDeploymentForTeam := func(team string) *appsv1.Deployment {
		return &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":          "[]",
					"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
					"multi-juicer.owasp-juice.shop/lastRequest":         "1729259667397",
					"multi-juicer.owasp-juice.shop/lastRequestReadable": "2024-10-18 13:55:18.08198884+0000 UTC m=+11.556786174",
					"multi-juicer.owasp-juice.shop/passcode":            "$2a$10$wnxvqClPk/13SbdowdJtu.2thGxrZe4qrsaVdTVUsYIrVVClhPMfS",
				},
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
					"team":                      team,
				},
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas: 1,
			},
		}
	}
	createServiceForTeam := func(team string) *corev1.Service {
		return &corev1.Service{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
					"team":                      team,
				},
			},
			Spec: corev1.ServiceSpec{
				Ports: []corev1.ServicePort{
					{
						Port: 3000,
					},
				},
			},
		}
	}

	t.Run("deleting instances requires admin login", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", "/balancer/api/admin/teams/foobar/delete", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("some team")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(createDeploymentForTeam("foobar"), createServiceForTeam("foobar"))
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "\n", rr.Body.String())
	})

	t.Run("deletes both deployments and services of teams", func(t *testing.T) {
		req, _ := http.NewRequest("DELETE", "/balancer/api/admin/teams/foobar/delete", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(
			createDeploymentForTeam("foobar"),
			createServiceForTeam("foobar"),
			createDeploymentForTeam("other-team"),
			createServiceForTeam("other-team"),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "", rr.Body.String())

		actions := clientset.Actions()

		assert.Equal(t, "delete", actions[0].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[0].GetResource())
		assert.Equal(t, "delete", actions[1].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, actions[1].GetResource())

		deployments, err := clientset.AppsV1().Deployments("test-namespace").List(context.Background(), metav1.ListOptions{})
		assert.Nil(t, err)
		assert.Len(t, deployments.Items, 1)

		services, err := clientset.CoreV1().Services("test-namespace").List(context.Background(), metav1.ListOptions{})
		assert.Nil(t, err)
		assert.Len(t, services.Items, 1)
	})

}
