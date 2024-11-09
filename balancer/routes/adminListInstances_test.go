package routes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes/fake"
)

func TestAdminListInstanceshandler(t *testing.T) {
	createTeam := func(team string, createdAt time.Time, lastRequest time.Time, readyReplicas int32) *appsv1.Deployment {
		return &appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				CreationTimestamp: metav1.Time{
					Time: createdAt,
				},
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":          "[]",
					"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
					"multi-juicer.owasp-juice.shop/lastRequest":         fmt.Sprintf("%d", lastRequest.UnixMilli()),
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
				ReadyReplicas: readyReplicas,
			},
		}
	}

	t.Run("listing instances requires admin login", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/all", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("some team")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset()
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "\n", rr.Body.String())
	})

	t.Run("lists all juice shop instances", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/balancer/api/admin/all", nil)
		req.Header.Set("Cookie", fmt.Sprintf("team=%s", testutil.SignTestTeamname("admin")))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(
			createTeam("foobar", time.UnixMilli(1_700_000_000_000), time.UnixMilli(1_729_259_666_123), 1),
			createTeam("test-team", time.UnixMilli(1_600_000_000_000), time.UnixMilli(1_729_259_333_123), 0),
		)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)

		var response AdminListInstancesResponse
		err := json.Unmarshal(rr.Body.Bytes(), &response)
		assert.Nil(t, err)

		assert.Equal(t, []AdminListJuiceShopInstance{
			{
				Team:        "foobar",
				Ready:       true,
				CreatedAt:   1_700_000_000_000,
				LastConnect: 1_729_259_666_123,
			},
			{
				Team:        "test-team",
				Ready:       false,
				CreatedAt:   1_600_000_000_000,
				LastConnect: 1_729_259_333_123,
			},
		}, response.Instances)
	})
}
