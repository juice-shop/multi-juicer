package routes

import (
	"bytes"
	"context"
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

	createTeam := func(team string) *appsv1.Deployment {
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

	balancerDeployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "balancer",
			Namespace: "test-namespace",
			UID:       "34c0bb8a-240b-4f2a-84ae-2eb2258298f9",
		},
	}

	t.Run("creates a deployment and service on join", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/teams/%s/join", team), nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(balancerDeployment)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		actions := clientset.Actions()
		assert.Equal(t, http.StatusOK, rr.Code)

		actionCounter := 0

		// should first check if deployment exists
		assert.Equal(t, "get", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[actionCounter].GetResource())
		actionCounter++

		// should then list deployments to get the current count of deployments
		assert.Equal(t, "list", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[actionCounter].GetResource())
		actionCounter++

		// then get the deployment uid of the balancer
		assert.Equal(t, "get", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[actionCounter].GetResource())
		actionCounter++

		// because the juice shop doesn't exist it should create it and a service for it
		assert.Equal(t, "create", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[actionCounter].GetResource())
		actionCounter++
		assert.Equal(t, "create", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "", Version: "v1", Resource: "services"}, actions[actionCounter].GetResource())
		actionCounter++

		assert.Regexp(t, regexp.MustCompile(`team=foobar\..*; Path=/; HttpOnly; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
		assert.JSONEq(t, `{"message":"Created Instance","passcode":"12345678"}`, rr.Body.String())

		deployment, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.NoError(t, err)

		var truePointer = true
		assert.Equal(t, []metav1.OwnerReference{
			{
				APIVersion:         "apps/v1",
				Kind:               "Deployment",
				Name:               "balancer",
				UID:                "34c0bb8a-240b-4f2a-84ae-2eb2258298f9",
				Controller:         &truePointer,
				BlockOwnerDeletion: &truePointer,
			},
		}, deployment.OwnerReferences)

		service, err := clientset.CoreV1().Services("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.NoError(t, err)

		assert.Equal(t, []metav1.OwnerReference{
			{
				APIVersion:         "apps/v1",
				Kind:               "Deployment",
				Name:               "balancer",
				UID:                "34c0bb8a-240b-4f2a-84ae-2eb2258298f9",
				Controller:         &truePointer,
				BlockOwnerDeletion: &truePointer,
			},
		}, service.OwnerReferences)
	})

	t.Run("set secure flag on team cookie when configured", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/teams/%s/join", team), nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(balancerDeployment)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		bundle.Config.CookieConfig.Secure = true
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Regexp(t, regexp.MustCompile(`team=foobar\..*; Path=/; HttpOnly; Secure; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
	})

	t.Run("refuses to create a team if max instances limit is reached", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/teams/%s/join", team), nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(
			balancerDeployment,
			createTeam("team-1"),
			createTeam("team-2"),
			createTeam("team-3"),
		)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		bundle.Config.MaxInstances = 3
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
		assert.JSONEq(t, `{"message":"Reached Maximum Instance Count","description":"Find an admin to handle this."}`, rr.Body.String())
	})

	t.Run("rejects invalid teamnames", func(t *testing.T) {
		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		invalidTeamnames := []string{
			"foo bar",
			"FOOOBAR",
			"fooooooooooooooooooooooooooooo",
		}
		for _, team := range invalidTeamnames {
			req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/teams/%s/join", team), nil)
			rr := httptest.NewRecorder()
			server.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusBadRequest, rr.Code, fmt.Sprintf("expected status code 400 for teamname '%s'", team))
		}
	})

	t.Run("if team already exists then join requires a passcode", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/teams/%s/join", team), nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(balancerDeployment, createTeam(team))

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})

	t.Run("is able to join team when the requests includes a correct passcode", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "02101791"})
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/teams/%s/join", team), bytes.NewReader(jsonPayload))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(balancerDeployment, createTeam(team))

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Regexp(t, regexp.MustCompile(`team=foobar\..*; Path=/; HttpOnly; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
	})

	t.Run("join is rejected when the passcode doesn't match", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "00000000"})
		req, _ := http.NewRequest("POST", fmt.Sprintf("/balancer/api/teams/%s/join", team), bytes.NewReader(jsonPayload))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(balancerDeployment, createTeam(team))

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})

	t.Run("allows admins login with the correct passcode", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "mock-admin-password"})
		req, _ := http.NewRequest("POST", "/balancer/api/teams/admin/join", bytes.NewReader(jsonPayload))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Regexp(t, regexp.MustCompile(`team=admin\..*; Path=/; HttpOnly; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
	})

	t.Run("admin login returns usual 'requires auth' response when it get's no request body passed", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/balancer/api/teams/admin/join", nil)
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})

	t.Run("admin account requires the correct passcod", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "wrong-password"})
		req, _ := http.NewRequest("POST", "/balancer/api/teams/admin/join", bytes.NewReader(jsonPayload))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})

	t.Run("admin login doesn't make any kubernetes api calls / creates not kubernetes resources", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "mock-admin-password"})
		req, _ := http.NewRequest("POST", "/balancer/api/teams/admin/join", bytes.NewReader(jsonPayload))
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewSimpleClientset(balancerDeployment)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Len(t, clientset.Actions(), 0)
	})
}
