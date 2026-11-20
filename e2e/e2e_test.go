//go:build e2e

package e2e

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

const (
	requestTimeout  = 15 * time.Second
	startupTimeout  = 5 * time.Minute
	deletionTimeout = 2 * time.Minute
	apiPrefix       = "/multi-juicer/api"
)

type suite struct {
	baseURL   string
	namespace string
	kube      *kubernetes.Clientset
	ownerUID  types.UID
}

type team struct {
	name     string
	passcode string
	client   *http.Client
}

type teamStatus struct {
	Name      string `json:"name"`
	Readiness bool   `json:"readiness"`
}

type instanceList struct {
	Instances []struct {
		Team  string `json:"team"`
		Ready bool   `json:"ready"`
	} `json:"instances"`
}

func TestTeamLifecycle(t *testing.T) {
	s := newSuite(t)
	anonymous := newClient(t)
	response := s.request(t, anonymous, "GET", "/", nil, http.StatusFound, nil)
	if response.Header.Get("Location") != "/multi-juicer" {
		t.Fatalf("anonymous proxy redirect = %q, want /multi-juicer", response.Header.Get("Location"))
	}
	s.request(t, anonymous, "GET", apiPrefix+"/admin/all", nil, http.StatusUnauthorized, nil)

	admin := newClient(t)
	s.request(t, admin, "POST", apiPrefix+"/teams/admin/join", map[string]string{
		"passcode": requiredEnv(t, "E2E_ADMIN_PASSWORD"),
	}, http.StatusOK, nil)

	runID := make([]byte, 4)
	if _, err := rand.Read(runID); err != nil {
		t.Fatal(err)
	}
	prefix := "e2e-" + hex.EncodeToString(runID)
	t.Log("Creating two independent teams and waiting for real Juice Shop pods")
	a := s.createTeam(t, prefix+"-a")
	b := s.createTeam(t, prefix+"-b")
	s.waitForTeam(t, a)
	s.waitForTeam(t, b)
	s.checkProducts(t, a.client)
	s.checkProducts(t, b.client)

	t.Log("Checking team login, logout, and administrator authorization")
	member := newClient(t)
	s.request(t, member, "POST", apiPrefix+"/teams/"+a.name+"/join", map[string]string{
		"passcode": "incorrect-passcode",
	}, http.StatusUnauthorized, nil)
	s.request(t, member, "GET", apiPrefix+"/teams/status", nil, http.StatusNotFound, nil)
	s.request(t, member, "POST", apiPrefix+"/teams/"+a.name+"/join", map[string]string{
		"passcode": a.passcode,
	}, http.StatusOK, nil)
	var status teamStatus
	s.request(t, member, "GET", apiPrefix+"/teams/status", nil, http.StatusOK, &status)
	if status.Name != a.name || !status.Readiness {
		t.Fatalf("joined member status = %+v, want ready team %s", status, a.name)
	}
	s.checkProducts(t, member)
	s.request(t, member, "POST", apiPrefix+"/teams/logout", nil, http.StatusOK, nil)
	response = s.request(t, member, "GET", "/", nil, http.StatusFound, nil)
	if response.Header.Get("Location") != "/multi-juicer" {
		t.Fatalf("logged-out proxy redirect = %q, want /multi-juicer", response.Header.Get("Location"))
	}
	s.request(t, a.client, "GET", apiPrefix+"/admin/all", nil, http.StatusUnauthorized, nil)
	s.request(t, a.client, "DELETE", apiPrefix+"/admin/teams/"+b.name+"/delete", nil, http.StatusUnauthorized, nil)
	var instances instanceList
	s.request(t, admin, "GET", apiPrefix+"/admin/all", nil, http.StatusOK, &instances)
	for _, name := range []string{a.name, b.name} {
		if !instances.ready(name) {
			t.Fatalf("admin list does not include ready team %s: %+v", name, instances)
		}
	}

	t.Log("Checking cookie routing and database isolation using Juice Shop accounts")
	email := prefix + "@example.test"
	passwordA, passwordB := "e2e-password-alpha", "e2e-password-bravo"
	s.registerUser(t, a.client, email, passwordA)
	s.loginUser(t, a.client, email, passwordA, http.StatusOK)
	s.loginUser(t, b.client, email, passwordA, http.StatusUnauthorized)
	// An identical email can be registered independently in the second database.
	s.registerUser(t, b.client, email, passwordB)
	s.loginUser(t, b.client, email, passwordB, http.StatusOK)
	s.loginUser(t, a.client, email, passwordB, http.StatusUnauthorized)
	s.loginUser(t, a.client, email, passwordA, http.StatusOK)

	t.Log("Deleting a team and checking Kubernetes garbage collection and survivor access")
	s.deleteTeam(t, admin, a)
	s.checkProducts(t, b.client)
	s.loginUser(t, b.client, email, passwordB, http.StatusOK)
	s.deleteTeam(t, admin, b)
}

func newSuite(t *testing.T) *suite {
	t.Helper()
	baseURL := strings.TrimRight(requiredEnv(t, "E2E_BASE_URL"), "/")
	parsed, err := url.Parse(baseURL)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		t.Fatal("E2E_BASE_URL must be an HTTP(S) origin, for example http://127.0.0.1:8080")
	}
	config, err := clientcmd.BuildConfigFromFlags("", requiredEnv(t, "KUBECONFIG"))
	if err != nil {
		t.Fatalf("load isolated kubeconfig: %v", err)
	}
	config.Timeout = requestTimeout
	kube, err := kubernetes.NewForConfig(config)
	if err != nil {
		t.Fatalf("create Kubernetes client: %v", err)
	}
	s := &suite{baseURL: baseURL, namespace: requiredEnv(t, "E2E_NAMESPACE"), kube: kube}
	ctx, cancel := context.WithTimeout(t.Context(), requestTimeout)
	defer cancel()
	deployment, err := kube.AppsV1().Deployments(s.namespace).Get(ctx, "multi-juicer", metav1.GetOptions{})
	if err != nil {
		t.Fatalf("find MultiJuicer deployment in namespace %s: %v", s.namespace, err)
	}
	s.ownerUID = deployment.UID
	return s
}

func requiredEnv(t *testing.T, name string) string {
	t.Helper()
	value := os.Getenv(name)
	if value == "" {
		t.Fatalf("%s is required; run the E2E runner to provision an isolated cluster", name)
	}
	return value
}

func newClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Client{
		Jar:           jar,
		Timeout:       requestTimeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func (s *suite) createTeam(t *testing.T, name string) team {
	t.Helper()
	// The runner collects diagnostics before deleting its isolated cluster.
	// Preserve failed instances for that collection instead of removing evidence.
	t.Cleanup(func() {
		if t.Failed() {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), requestTimeout)
		defer cancel()
		err := s.kube.AppsV1().Deployments(s.namespace).Delete(ctx, "juiceshop-"+name, metav1.DeleteOptions{})
		if err != nil && !apierrors.IsNotFound(err) {
			t.Errorf("clean up team %s: %v", name, err)
		}
	})
	client := newClient(t)
	var joined struct {
		Message  string `json:"message"`
		Passcode string `json:"passcode"`
	}
	response := s.request(t, client, "POST", apiPrefix+"/teams/"+name+"/join", map[string]string{}, http.StatusOK, &joined)
	if joined.Message != "Created Instance" || joined.Passcode == "" {
		t.Fatalf("team %s was not created with a passcode (message %q)", name, joined.Message)
	}
	foundCookie := false
	for _, cookie := range response.Cookies() {
		if cookie.Name == "multi-juicer" && cookie.Value != "" && cookie.Path == "/" && cookie.HttpOnly {
			foundCookie = true
		}
	}
	if !foundCookie {
		t.Fatalf("team %s creation did not set the expected HttpOnly session cookie", name)
	}
	return team{name: name, passcode: joined.Passcode, client: client}
}

func (s *suite) waitForTeam(t *testing.T, team team) {
	t.Helper()
	waitFor(t, startupTimeout, "ready Juice Shop for "+team.name, func(ctx context.Context) error {
		deployment, err := s.kube.AppsV1().Deployments(s.namespace).Get(ctx, "juiceshop-"+team.name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		owner := metav1.GetControllerOf(deployment)
		if owner == nil || owner.UID != s.ownerUID {
			return fmt.Errorf("Juice Shop deployment has no controller reference to MultiJuicer")
		}
		if deployment.Status.ObservedGeneration < deployment.Generation || deployment.Status.ReadyReplicas != 1 {
			return fmt.Errorf("deployment ready replicas = %d", deployment.Status.ReadyReplicas)
		}
		service, err := s.kube.CoreV1().Services(s.namespace).Get(ctx, deployment.Name, metav1.GetOptions{})
		if err != nil {
			return err
		}
		owner = metav1.GetControllerOf(service)
		if owner == nil || owner.UID != deployment.UID {
			return fmt.Errorf("Juice Shop service has no controller reference to its deployment")
		}
		pods, err := s.kube.CoreV1().Pods(s.namespace).List(ctx, metav1.ListOptions{LabelSelector: teamSelector(team.name)})
		if err != nil {
			return err
		}
		if len(pods.Items) != 1 || !podReady(pods.Items[0]) {
			return fmt.Errorf("expected one ready Juice Shop pod, found %d pods", len(pods.Items))
		}
		response, body, err := s.do(ctx, team.client, "GET", apiPrefix+"/teams/status", nil)
		if err != nil {
			return err
		}
		if response.StatusCode != http.StatusOK {
			return fmt.Errorf("team status HTTP %d: %s", response.StatusCode, excerpt(body))
		}
		var status teamStatus
		if err := json.Unmarshal(body, &status); err != nil {
			return fmt.Errorf("decode team status: %w", err)
		}
		if status.Name != team.name || !status.Readiness {
			return fmt.Errorf("team status = %+v", status)
		}
		// A ready pod can precede the Service endpoint update. Wait for a real
		// proxied response as well before asserting synchronous user operations.
		return s.products(ctx, team.client)
	})
}

func podReady(pod corev1.Pod) bool {
	if pod.DeletionTimestamp != nil || pod.Status.Phase != corev1.PodRunning {
		return false
	}
	for _, condition := range pod.Status.Conditions {
		if condition.Type == corev1.PodReady && condition.Status == corev1.ConditionTrue {
			return true
		}
	}
	return false
}

func teamSelector(name string) string {
	return "app.kubernetes.io/name=juice-shop,app.kubernetes.io/part-of=multi-juicer,team=" + name
}

func (s *suite) checkProducts(t *testing.T, client *http.Client) {
	t.Helper()
	if err := s.products(t.Context(), client); err != nil {
		t.Fatalf("proxied Juice Shop catalogue: %v", err)
	}
}

func (s *suite) products(ctx context.Context, client *http.Client) error {
	response, body, err := s.do(ctx, client, "GET", "/api/Products", nil)
	if err != nil {
		return err
	}
	if response.StatusCode != http.StatusOK || !strings.HasPrefix(response.Header.Get("Content-Type"), "application/json") {
		return fmt.Errorf("GET /api/Products: HTTP %d, Content-Type %q, body %s", response.StatusCode, response.Header.Get("Content-Type"), excerpt(body))
	}
	var products struct {
		Status string `json:"status"`
		Data   []struct {
			ID int `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &products); err != nil {
		return fmt.Errorf("decode Juice Shop catalogue: %w", err)
	}
	if products.Status != "success" || len(products.Data) == 0 || products.Data[0].ID == 0 {
		return fmt.Errorf("/api/Products did not return a real Juice Shop product catalogue")
	}
	return nil
}

func (s *suite) registerUser(t *testing.T, client *http.Client, email, password string) {
	t.Helper()
	var user struct {
		Data struct {
			ID    int    `json:"id"`
			Email string `json:"email"`
		} `json:"data"`
	}
	s.request(t, client, "POST", "/api/Users", map[string]string{
		"email": email, "password": password, "passwordRepeat": password,
	}, http.StatusCreated, &user)
	if user.Data.ID == 0 || user.Data.Email != email {
		t.Fatalf("Juice Shop registration returned unexpected user: %+v", user.Data)
	}
}

func (s *suite) loginUser(t *testing.T, client *http.Client, email, password string, expected int) {
	t.Helper()
	var login struct {
		Authentication struct {
			Token string `json:"token"`
			Email string `json:"umail"`
		} `json:"authentication"`
	}
	var target any
	if expected == http.StatusOK {
		target = &login
	}
	s.request(t, client, "POST", "/rest/user/login", map[string]string{
		"email": email, "password": password,
	}, expected, target)
	if expected == http.StatusOK && (login.Authentication.Token == "" || login.Authentication.Email != email) {
		t.Fatal("Juice Shop login did not return a token for the expected user")
	}
}

func (instances instanceList) ready(name string) bool {
	for _, instance := range instances.Instances {
		if instance.Team == name && instance.Ready {
			return true
		}
	}
	return false
}

func (s *suite) deleteTeam(t *testing.T, admin *http.Client, team team) {
	t.Helper()
	s.request(t, admin, "DELETE", apiPrefix+"/admin/teams/"+team.name+"/delete", nil, http.StatusOK, nil)
	waitFor(t, deletionTimeout, "garbage collection for "+team.name, func(ctx context.Context) error {
		_, err := s.kube.AppsV1().Deployments(s.namespace).Get(ctx, "juiceshop-"+team.name, metav1.GetOptions{})
		if err == nil {
			return fmt.Errorf("deployment still exists")
		}
		if !apierrors.IsNotFound(err) {
			return err
		}
		_, err = s.kube.CoreV1().Services(s.namespace).Get(ctx, "juiceshop-"+team.name, metav1.GetOptions{})
		if err == nil {
			return fmt.Errorf("service still exists")
		}
		if !apierrors.IsNotFound(err) {
			return err
		}
		pods, err := s.kube.CoreV1().Pods(s.namespace).List(ctx, metav1.ListOptions{LabelSelector: teamSelector(team.name)})
		if err != nil {
			return err
		}
		if len(pods.Items) != 0 {
			return fmt.Errorf("%d Juice Shop pods remain", len(pods.Items))
		}
		response, body, err := s.do(ctx, team.client, "GET", "/", nil)
		if err != nil {
			return err
		}
		location, err := response.Location()
		if err != nil || response.StatusCode != http.StatusFound || location.Path != "/multi-juicer/" || location.Query().Get("msg") != "instance-not-found" || location.Query().Get("team") != team.name {
			return fmt.Errorf("deleted team proxy: HTTP %d, Location %q, body %s", response.StatusCode, response.Header.Get("Location"), excerpt(body))
		}
		return nil
	})
	var instances instanceList
	s.request(t, admin, "GET", apiPrefix+"/admin/all", nil, http.StatusOK, &instances)
	for _, instance := range instances.Instances {
		if instance.Team == team.name {
			t.Fatalf("deleted team %s remains in admin list", team.name)
		}
	}
}

func waitFor(t *testing.T, timeout time.Duration, description string, check func(context.Context) error) {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), timeout)
	defer cancel()
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for {
		err := check(ctx)
		if err == nil {
			return
		}
		select {
		case <-ctx.Done():
			t.Fatalf("timed out waiting for %s: %v", description, err)
		case <-ticker.C:
		}
	}
}

func (s *suite) request(t *testing.T, client *http.Client, method, path string, payload any, expected int, target any) *http.Response {
	t.Helper()
	response, body, err := s.do(t.Context(), client, method, path, payload)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	if response.StatusCode != expected {
		t.Fatalf("%s %s: HTTP %d, want %d; body: %s", method, path, response.StatusCode, expected, excerpt(body))
	}
	if target != nil {
		if !strings.HasPrefix(response.Header.Get("Content-Type"), "application/json") {
			t.Fatalf("%s %s: expected JSON, got %q; body: %s", method, path, response.Header.Get("Content-Type"), excerpt(body))
		}
		if err := json.Unmarshal(body, target); err != nil {
			t.Fatalf("%s %s: decode response: %v; body: %s", method, path, err, excerpt(body))
		}
	}
	return response
}

func (s *suite) do(ctx context.Context, client *http.Client, method, path string, payload any) (*http.Response, []byte, error) {
	var reader io.Reader
	if payload != nil {
		body, err := json.Marshal(payload)
		if err != nil {
			return nil, nil, err
		}
		reader = bytes.NewReader(body)
	}
	request, err := http.NewRequestWithContext(ctx, method, s.baseURL+path, reader)
	if err != nil {
		return nil, nil, err
	}
	if payload != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, nil, err
	}
	defer response.Body.Close()
	const maxBody = 1 << 20
	body, err := io.ReadAll(io.LimitReader(response.Body, maxBody+1))
	if err == nil && len(body) > maxBody {
		err = fmt.Errorf("response exceeds %d bytes", maxBody)
	}
	return response, body, err
}

func excerpt(body []byte) string {
	const limit = 1024
	if len(body) > limit {
		return string(body[:limit]) + "..."
	}
	return string(body)
}
