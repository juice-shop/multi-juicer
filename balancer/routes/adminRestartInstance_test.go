package routes

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAdminRestartInstanceHandler(t *testing.T) {
	createPodForTeam := func(team string) *corev1.Pod {
		return &corev1.Pod{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Labels: map[string]string{
					"app.kubernetes.io/name":    "juice-shop",
					"app.kubernetes.io/part-of": "multi-juicer",
					"team":                      team,
				},
			},
			Spec: corev1.PodSpec{},
		}
	}

	t.Run("restarting instances requires admin login", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/admin/teams/foobar/restart", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("some team")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(createPodForTeam("foobar"))
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "\n", rr.Body.String())
	})

	t.Run("rejects invalid team names", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/admin/teams/%s/restart", "invälid"), nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(createPodForTeam("foobar"))
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
	})

	t.Run("restart instances deletes the pod for the instance", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/admin/teams/foobar/restart", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(createPodForTeam("foobar"), createPodForTeam("other-team"))
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Equal(t, "", rr.Body.String())

		actions := clientset.Actions()

		assert.Len(t, actions, 2)

		assert.Equal(t, "list", actions[0].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}, actions[0].GetResource())
		assert.Equal(t, "delete", actions[1].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "", Version: "v1", Resource: "pods"}, actions[1].GetResource())

		pods, err := clientset.CoreV1().Pods("test-namespace").List(context.Background(), metav1.ListOptions{})
		assert.Nil(t, err)
		assert.Len(t, pods.Items, 1)
	})
}
