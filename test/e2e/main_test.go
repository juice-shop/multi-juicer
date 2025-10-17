package e2e

import (
"context"
"encoding/json"
"fmt"
"io"
"net/http"
"os"
"testing"
"time"

"github.com/stretchr/testify/assert"
"github.com/stretchr/testify/require"
corev1 "k8s.io/api/core/v1"
metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
"k8s.io/client-go/kubernetes"
"k8s.io/client-go/tools/clientcmd"
)

type E2ETestSuite struct {
	client    *kubernetes.Clientset
	namespace string
	baseURL   string
}

func TestE2EMultiJuicer(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping E2E tests in short mode")
	}

	suite := setupTestSuite(t)

	t.Run("TestDeploymentReady", suite.testDeploymentReady)
	t.Run("TestBalancerHealthCheck", suite.testBalancerHealthCheck)
	t.Run("TestJoinTeam", suite.testJoinTeam)
	t.Run("TestJuiceShopInstanceCreation", suite.testJuiceShopInstanceCreation)
	t.Run("TestActivityFeed", suite.testActivityFeed)
	t.Run("TestProgressPersistence", suite.testProgressPersistence)
	t.Run("TestInstanceCleanup", suite.testInstanceCleanup)
	t.Run("TestScoreboard", suite.testScoreboard)
}

func setupTestSuite(t *testing.T) *E2ETestSuite {
	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		kubeconfig = os.Getenv("HOME") + "/.kube/config"
	}

	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	require.NoError(t, err, "Failed to load kubeconfig")

	client, err := kubernetes.NewForConfig(config)
	require.NoError(t, err, "Failed to create Kubernetes client")

	namespace := os.Getenv("E2E_NAMESPACE")
	if namespace == "" {
		namespace = "multi-juicer"
	}

	baseURL := os.Getenv("E2E_BASE_URL")
	if baseURL == "" {
		baseURL = "http://localhost:8080"
	}

	return &E2ETestSuite{
		client:    client,
		namespace: namespace,
		baseURL:   baseURL,
	}
}

func (s *E2ETestSuite) testDeploymentReady(t *testing.T) {
	ctx := context.Background()

	// Check balancer deployment
	deployment, err := s.client.AppsV1().Deployments(s.namespace).Get(ctx, "juice-balancer", metav1.GetOptions{})
	require.NoError(t, err, "Failed to get balancer deployment")
	assert.Equal(t, deployment.Status.ReadyReplicas, *deployment.Spec.Replicas, "Balancer deployment not ready")

	// Check progress-watchdog deployment
	deployment, err = s.client.AppsV1().Deployments(s.namespace).Get(ctx, "progress-watchdog", metav1.GetOptions{})
	require.NoError(t, err, "Failed to get progress-watchdog deployment")
	assert.Equal(t, deployment.Status.ReadyReplicas, *deployment.Spec.Replicas, "Progress-watchdog deployment not ready")
}

func (s *E2ETestSuite) testBalancerHealthCheck(t *testing.T) {
	resp, err := http.Get(s.baseURL + "/balancer/api/health")
	require.NoError(t, err, "Failed to reach balancer health endpoint")
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Balancer health check failed")
}

func (s *E2ETestSuite) testJoinTeam(t *testing.T) {
	teamName := fmt.Sprintf("e2e-test-team-%d", time.Now().Unix())

	resp, err := http.Post(s.baseURL+"/balancer/api/teams/"+teamName+"/join", "application/json", nil)
	require.NoError(t, err, "Failed to join team")
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Failed to join team")

	// Verify cookie is set
	cookies := resp.Cookies()
	found := false
	for _, cookie := range cookies {
		if cookie.Name == "team" {
			found = true
			assert.NotEmpty(t, cookie.Value, "Team cookie value is empty")
			break
		}
	}
	assert.True(t, found, "Team cookie not found")
}

func (s *E2ETestSuite) testJuiceShopInstanceCreation(t *testing.T) {
	teamName := fmt.Sprintf("e2e-instance-test-%d", time.Now().Unix())

	// Join team
	resp, err := http.Post(s.baseURL+"/balancer/api/teams/"+teamName+"/join", "application/json", nil)
	require.NoError(t, err)
	resp.Body.Close()

	// Wait for instance to be created
	ctx := context.Background()
	require.Eventually(t, func() bool {
		_, err := s.client.AppsV1().Deployments(s.namespace).Get(ctx, "juice-shop-"+teamName, metav1.GetOptions{})
		return err == nil
	}, 30*time.Second, 1*time.Second, "Juice Shop instance not created")

	// Verify the deployment is ready
	require.Eventually(t, func() bool {
		deployment, err := s.client.AppsV1().Deployments(s.namespace).Get(ctx, "juice-shop-"+teamName, metav1.GetOptions{})
		if err != nil {
			return false
		}
		return deployment.Status.ReadyReplicas > 0
	}, 60*time.Second, 2*time.Second, "Juice Shop instance not ready")
}

func (s *E2ETestSuite) testActivityFeed(t *testing.T) {
	resp, err := http.Get(s.baseURL + "/balancer/api/activity-feed")
	require.NoError(t, err, "Failed to get activity feed")
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Activity feed endpoint failed")

	var events []map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&events)
	require.NoError(t, err, "Failed to decode activity feed response")

	// Verify the structure of events (if any exist)
	for _, event := range events {
		assert.Contains(t, event, "team", "Event missing team field")
		assert.Contains(t, event, "challengeKey", "Event missing challengeKey field")
		assert.Contains(t, event, "challengeName", "Event missing challengeName field")
		assert.Contains(t, event, "points", "Event missing points field")
		assert.Contains(t, event, "solvedAt", "Event missing solvedAt field")
	}
}

func (s *E2ETestSuite) testProgressPersistence(t *testing.T) {
	teamName := fmt.Sprintf("e2e-progress-test-%d", time.Now().Unix())

	// Join team and wait for instance
	resp, err := http.Post(s.baseURL+"/balancer/api/teams/"+teamName+"/join", "application/json", nil)
	require.NoError(t, err)
	resp.Body.Close()

	ctx := context.Background()

	// Wait for deployment
	require.Eventually(t, func() bool {
		deployment, err := s.client.AppsV1().Deployments(s.namespace).Get(ctx, "juice-shop-"+teamName, metav1.GetOptions{})
		if err != nil {
			return false
		}
		return deployment.Status.ReadyReplicas > 0
	}, 60*time.Second, 2*time.Second)

	// Check that progress-watchdog creates a backup
	require.Eventually(t, func() bool {
		pods, err := s.client.CoreV1().Pods(s.namespace).List(ctx, metav1.ListOptions{
LabelSelector: "app.kubernetes.io/name=progress-watchdog",
})
		if err != nil || len(pods.Items) == 0 {
			return false
		}

		// Check logs for backup activity
		logs, err := s.client.CoreV1().Pods(s.namespace).GetLogs(pods.Items[0].Name, &corev1.PodLogOptions{
			TailLines: int64Ptr(100),
		}).Stream(ctx)
		if err != nil {
			return false
		}
		defer logs.Close()

		logBytes, _ := io.ReadAll(logs)
		return len(logBytes) > 0
	}, 30*time.Second, 2*time.Second, "Progress watchdog not working")
}

func (s *E2ETestSuite) testInstanceCleanup(t *testing.T) {
	if os.Getenv("SKIP_CLEANUP_TEST") == "true" {
		t.Skip("Skipping cleanup test")
	}

	ctx := context.Background()

	// Verify cleaner is running
	pods, err := s.client.CoreV1().Pods(s.namespace).List(ctx, metav1.ListOptions{
LabelSelector: "app.kubernetes.io/name=cleaner",
})
	require.NoError(t, err)
	assert.NotEmpty(t, pods.Items, "Cleaner pod not found")
}

func (s *E2ETestSuite) testScoreboard(t *testing.T) {
	resp, err := http.Get(s.baseURL + "/balancer/api/scoreboard")
	require.NoError(t, err, "Failed to get scoreboard")
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode, "Scoreboard endpoint failed")

	var scoreboard map[string]interface{}
	err = json.NewDecoder(resp.Body).Decode(&scoreboard)
	require.NoError(t, err, "Failed to decode scoreboard response")

	assert.Contains(t, scoreboard, "teams", "Scoreboard missing teams field")
}

func int64Ptr(i int64) *int64 {
	return &i
}
