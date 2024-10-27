package routes

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/juice-shop/multi-juicer/balancer/pkg/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/kubernetes/fake"
)

func TestJoinHandler(t *testing.T) {
	team := "foobar"

	t.Run("creates a deployment and service on join", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/teams/%s/join", team), nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset()

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		actions := clientset.Actions()
		_ = actions
		assert.Equal(t, http.StatusOK, rr.Code)

		// should first check if deployment exists
		assert.Equal(t, "get", actions[0].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[0].GetResource())

		// because it doesn't it should create it and a service for it
		assert.Equal(t, "create", actions[1].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[1].GetResource())
		assert.Equal(t, "create", actions[2].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, actions[2].GetResource())

		assert.Regexp(t, regexp.MustCompile(`balancer=foobar\..*; Path=/; HttpOnly; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
		assert.JSONEq(t, `{"message":"Created Instance","passcode":"12345678"}`, rr.Body.String())
	})

	t.Run("rejects invalid teamnames", func(t *testing.T) {
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		invalidTeamnames := []string{
			"foo bar",
			"foo-bar",
			"FOOOBAR",
			"fooooooooooooooooooooooooooooo",
		}
		for _, team := range invalidTeamnames {
			req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/teams/%s/join", team), nil)
			rr := httptest.NewRecorder()
			server.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusBadRequest, rr.Code, fmt.Sprintf("expected status code 400 for teamname '%s'", team))
		}
	})

	t.Run("if team already exists then join requires a passcode", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/teams/%s/join", team), nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":          "[]",
					"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
					"multi-juicer.owasp-juice.shop/lastRequest":         "1729259667397",
					"multi-juicer.owasp-juice.shop/lastRequestReadable": "2024-10-18 13:55:18.08198884+0000 UTC m=+11.556786174",
					"multi-juicer.owasp-juice.shop/passcode":            "$2a$10$rSXobFHXy7dVo9CPYPh9w.VJHoek0OvoGpwu6Fv18Z/8UEFkeVFwK",
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

		actions := clientset.Actions()
		_ = actions
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})

	t.Run("is able to join team when the requests includes a correct passcode", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "02101791"})
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/teams/%s/join", team), bytes.NewReader(jsonPayload))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(&appsv1.Deployment{
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
				},
			},
			Status: appsv1.DeploymentStatus{
				ReadyReplicas: 1,
			},
		})

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		actions := clientset.Actions()
		_ = actions
		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Regexp(t, regexp.MustCompile(`balancer=foobar\..*; Path=/; HttpOnly; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
	})

	t.Run("join is rejected when the passcode doesn't match", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "00000000"})
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/teams/%s/join", team), bytes.NewReader(jsonPayload))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(&appsv1.Deployment{
			ObjectMeta: metav1.ObjectMeta{
				Name:      fmt.Sprintf("juiceshop-%s", team),
				Namespace: "test-namespace",
				Annotations: map[string]string{
					"multi-juicer.owasp-juice.shop/challenges":          "[]",
					"multi-juicer.owasp-juice.shop/challengesSolved":    "0",
					"multi-juicer.owasp-juice.shop/lastRequest":         "1729259667397",
					"multi-juicer.owasp-juice.shop/lastRequestReadable": "2024-10-18 13:55:18.08198884+0000 UTC m=+11.556786174",
					"multi-juicer.owasp-juice.shop/passcode":            "$2a$10$rSXobFHXy7dVo9CPYPh9w.VJHoek0OvoGpwu6Fv18Z/8UEFkeVFwK",
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

		actions := clientset.Actions()
		_ = actions
		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})
}
