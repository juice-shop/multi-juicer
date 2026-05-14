package public

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	"github.com/juice-shop/multi-juicer/internal/testutil"
	"github.com/stretchr/testify/assert"
	appsv1 "k8s.io/api/apps/v1"
	corev1 "k8s.io/api/core/v1"
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

	multiJuicerDeployment := &appsv1.Deployment{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "multi-juicer",
			Namespace: "test-namespace",
			UID:       "34c0bb8a-240b-4f2a-84ae-2eb2258298f9",
		},
	}

	t.Run("creates a deployment and service on join", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), nil)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(multiJuicerDeployment)

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

		// then get the deployment uid of multi-juicer
		assert.Equal(t, "get", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[actionCounter].GetResource())
		actionCounter++

		// because the juice shop doesn't exist it should create the deployment,
		// the per-team secret (holding the signed webhook url), and the service.
		assert.Equal(t, "create", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "apps", Version: "v1", Resource: "deployments"}, actions[actionCounter].GetResource())
		actionCounter++
		assert.Equal(t, "create", actions[actionCounter].GetVerb())
		assert.Equal(t, schema.GroupVersionResource{Group: "", Version: "v1", Resource: "secrets"}, actions[actionCounter].GetResource())
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
				Name:               "multi-juicer",
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
				Name:               deployment.Name,
				UID:                deployment.UID,
				Controller:         &truePointer,
				BlockOwnerDeletion: &truePointer,
			},
		}, service.OwnerReferences)
	})

	t.Run("creates a per-team secret with a signed webhook url", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), nil)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset(multiJuicerDeployment)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)

		secret, err := clientset.CoreV1().Secrets("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.NoError(t, err)

		// LLM is disabled in the default test bundle — only the webhook url should be present.
		assert.Contains(t, secret.Data, "solutionsWebhookUrl")
		assert.NotContains(t, secret.Data, "llmApiKey")

		// The signed URL must verify against the test signing key.
		expectedSig := testutil.SignTestWebhookTeamname(team)
		expectedURL := fmt.Sprintf("http://multijuicer-private.test-namespace.svc.cluster.local/team/%s/webhook/%s", team, expectedSig)
		assert.Equal(t, expectedURL, string(secret.Data["solutionsWebhookUrl"]))

		// Secret is owned by the team Deployment so it gets GC'd with it.
		deployment, err := clientset.AppsV1().Deployments("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.NoError(t, err)
		assert.Len(t, secret.OwnerReferences, 1)
		assert.Equal(t, deployment.Name, secret.OwnerReferences[0].Name)
		assert.Equal(t, deployment.UID, secret.OwnerReferences[0].UID)

		// The Juice Shop container's SOLUTIONS_WEBHOOK env must be sourced from this secret, not a literal URL.
		container := deployment.Spec.Template.Spec.Containers[0]
		var webhookEnv *corev1.EnvVar
		for i, env := range container.Env {
			if env.Name == "SOLUTIONS_WEBHOOK" {
				webhookEnv = &container.Env[i]
				break
			}
		}
		assert.NotNil(t, webhookEnv, "expected SOLUTIONS_WEBHOOK env var")
		assert.Empty(t, webhookEnv.Value, "SOLUTIONS_WEBHOOK must be sourced from a Secret, not a literal value")
		assert.NotNil(t, webhookEnv.ValueFrom)
		assert.NotNil(t, webhookEnv.ValueFrom.SecretKeyRef)
		assert.Equal(t, secret.Name, webhookEnv.ValueFrom.SecretKeyRef.Name)
		assert.Equal(t, "solutionsWebhookUrl", webhookEnv.ValueFrom.SecretKeyRef.Key)
	})

	t.Run("includes llmApiKey in the team secret when LLM is enabled", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), nil)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()
		clientset := fake.NewClientset(multiJuicerDeployment)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		bundle.Config.JuiceShopConfig.LLM.Enabled = true
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusOK, rr.Code)

		secret, err := clientset.CoreV1().Secrets("test-namespace").Get(context.Background(), fmt.Sprintf("juiceshop-%s", team), metav1.GetOptions{})
		assert.NoError(t, err)
		assert.Contains(t, secret.Data, "solutionsWebhookUrl")
		assert.Contains(t, secret.Data, "llmApiKey")
	})

	t.Run("set secure flag on team cookie when configured", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), nil)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(multiJuicerDeployment)

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		bundle.Config.CookieConfig.Secure = true
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Regexp(t, regexp.MustCompile(`team=foobar\..*; Path=/; HttpOnly; Secure; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
	})

	t.Run("refuses to create a team if max instances limit is reached", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), nil)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(
			multiJuicerDeployment,
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
			req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), nil)
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()
			server.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusBadRequest, rr.Code, fmt.Sprintf("expected status code 400 for teamname '%s'", team))
		}
	})

	t.Run("if team already exists then join requires a passcode", func(t *testing.T) {
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), nil)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(multiJuicerDeployment, createTeam(team))

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})

	t.Run("is able to join team when the requests includes a correct passcode", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "02101791"})
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), bytes.NewReader(jsonPayload))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(multiJuicerDeployment, createTeam(team))

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Regexp(t, regexp.MustCompile(`team=foobar\..*; Path=/; HttpOnly; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
	})

	t.Run("join is rejected when the passcode doesn't match", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "00000000"})
		req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), bytes.NewReader(jsonPayload))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(multiJuicerDeployment, createTeam(team))

		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusUnauthorized, rr.Code)
		assert.Equal(t, "", rr.Header().Get("Set-Cookie"))
	})

	t.Run("allows admins login with the correct passcode", func(t *testing.T) {
		jsonPayload, _ := json.Marshal(map[string]string{"passcode": "mock-admin-password"})
		req, _ := http.NewRequest("POST", "/multi-juicer/api/teams/admin/join", bytes.NewReader(jsonPayload))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		bundle := testutil.NewTestBundle()
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Regexp(t, regexp.MustCompile(`team=admin\..*; Path=/; HttpOnly; SameSite=Strict`), rr.Header().Get("Set-Cookie"))
	})

	t.Run("admin login returns usual 'requires auth' response when it get's no request body passed", func(t *testing.T) {
		req, _ := http.NewRequest("POST", "/multi-juicer/api/teams/admin/join", nil)
		req.Header.Set("Content-Type", "application/json")
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
		req, _ := http.NewRequest("POST", "/multi-juicer/api/teams/admin/join", bytes.NewReader(jsonPayload))
		req.Header.Set("Content-Type", "application/json")
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
		req, _ := http.NewRequest("POST", "/multi-juicer/api/teams/admin/join", bytes.NewReader(jsonPayload))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		server := http.NewServeMux()

		clientset := fake.NewClientset(multiJuicerDeployment)
		bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
		AddRoutes(server, bundle)

		server.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Len(t, clientset.Actions(), 0)
	})

	t.Run("rejects login CSRF via cross-site form submission (issue #525)", func(t *testing.T) {
		// Browsers can only set Content-Type to application/x-www-form-urlencoded,
		// multipart/form-data, or text/plain without triggering a CORS preflight.
		// All three must be rejected so an attacker can't trick a victim into
		// logging in as the attacker's team.
		csrfContentTypes := []string{
			"text/plain",
			"application/x-www-form-urlencoded",
			"multipart/form-data; boundary=----WebKitFormBoundary",
			"",
		}
		for _, ct := range csrfContentTypes {
			jsonPayload := []byte(`{"passcode":"02101791","whatever":"`)
			req, _ := http.NewRequest("POST", fmt.Sprintf("/multi-juicer/api/teams/%s/join", team), bytes.NewReader(jsonPayload))
			if ct != "" {
				req.Header.Set("Content-Type", ct)
			}
			rr := httptest.NewRecorder()

			server := http.NewServeMux()
			clientset := fake.NewClientset(multiJuicerDeployment, createTeam(team))
			bundle := testutil.NewTestBundleWithCustomFakeClient(clientset)
			AddRoutes(server, bundle)

			server.ServeHTTP(rr, req)

			assert.Equal(t, http.StatusUnsupportedMediaType, rr.Code, fmt.Sprintf("expected 415 for Content-Type %q", ct))
			assert.Equal(t, "", rr.Header().Get("Set-Cookie"), fmt.Sprintf("no cookie should be set for Content-Type %q", ct))
		}
	})
}
