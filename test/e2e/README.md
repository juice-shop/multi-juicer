# MultiJuicer End-to-End Tests

This directory contains comprehensive end-to-end (E2E) tests for the MultiJuicer platform running inside Kubernetes clusters. The tests run automatically via GitHub Actions against multiple Kubernetes versions.

## Overview

The E2E test suite validates:

- ✅ **Deployment Readiness**: Core components (balancer, progress-watchdog) are ready
- ✅ **Health Checks**: Balancer API responds to health check requests
- ✅ **Team Management**: Teams can join and receive unique cookies
- ✅ **Instance Creation**: Juice Shop instances are created dynamically per team
- ✅ **Activity Feed**: Challenge solve events are properly tracked and displayed
- ✅ **Progress Persistence**: Challenge progress is persisted via progress-watchdog
- ✅ **Instance Cleanup**: Cleaner removes abandoned instances
- ✅ **Scoreboard**: Team scores are calculated correctly

## Prerequisites

### For Local Testing
- Docker
- kubectl (v1.25+)
- Helm 3.13+
- KinD (Kubernetes in Docker)
- Go 1.24+
- Make

### For GitHub Actions
Automatically handled by the workflow

## Quick Start - Local Testing

### 1. Create and Setup KinD Cluster

```bash
cd test/e2e
make setup-kind
```

This creates a local Kubernetes cluster with proper port mappings and installs NGINX Ingress Controller.

### 2. Install MultiJuicer

```bash
make install-multi-juicer
```

This:
- Builds Docker images for all components (balancer, cleaner, progress-watchdog)
- Loads images into KinD
- Deploys MultiJuicer using Helm
- Waits for all deployments to be ready

### 3. Run Port Forwarding (in a separate terminal)

```bash
make port-forward
```

This exposes the balancer service on `http://localhost:8080`

### 4. Run E2E Tests

```bash
make run-tests
```

### 5. Cleanup

```bash
make cleanup
```

### Complete Setup in One Command

```bash
make all
```

**Note**: This runs `make all` which executes `setup-kind`, `install-multi-juicer`, and `port-forward` (won't exit), so you'll need to run `make run-tests` in another terminal.

## Viewing Logs and Status

```bash
# View deployment and pod status
make logs

# View specific component logs
kubectl logs -n multi-juicer deployment/juice-balancer --tail=200
kubectl logs -n multi-juicer deployment/progress-watchdog --tail=200
kubectl logs -n multi-juicer -l app.kubernetes.io/name=cleaner --tail=200

# View events
kubectl get events -n multi-juicer --sort-by='.lastTimestamp'
```

## GitHub Actions Workflow

The E2E tests run automatically on:

- **Push to main/master**: All E2E tests
- **Pull Requests**: All E2E tests
- **Daily Schedule**: 2 AM UTC

### Test Matrix

Tests run in parallel against multiple Kubernetes versions:
- v1.28.0
- v1.27.3
- v1.26.6
- v1.25.11

### Workflow Features

- **Parallel Execution**: Tests run simultaneously across K8s versions for speed
- **Automatic Logging**: Comprehensive logs collected on failure
- **Artifacts**: Test results uploaded as GitHub artifacts
- **Non-blocking**: Failures in one K8s version don't block others

### Viewing Workflow Results

1. Go to GitHub repository
2. Click "Actions" tab
3. Select "E2E Tests" workflow
4. Click specific run to see results
5. Scroll down to "Artifacts" to download logs

## Test Files

### `main_test.go`
Core test suite with:
- `TestE2EMultiJuicer`: Main test runner
- `testDeploymentReady`: Validates core deployments
- `testBalancerHealthCheck`: Health check endpoint
- `testJoinTeam`: Team creation and cookie assignment
- `testJuiceShopInstanceCreation`: Dynamic instance creation
- `testActivityFeed`: Activity feed endpoint and structure
- `testProgressPersistence`: Progress watchdog functionality
- `testInstanceCleanup`: Cleaner pod verification
- `testScoreboard`: Scoreboard endpoint validation

### `client.go`
Test helper client with:
- `TestClient`: HTTP client with cookie jar for team context
- `ActivityEvent`: Activity feed event structure
- Helper methods: `JoinTeam()`, `GetActivityFeed()`, `GetScoreboard()`, `SolveChallenge()`, `GetTeamStatus()`

### `go.mod`
Go module dependencies for:
- Kubernetes client libraries (k8s.io/client-go, k8s.io/api)
- Testing framework (testify)

## Running Specific Tests

### Run a Single Test

```bash
cd test/e2e
E2E_NAMESPACE=multi-juicer E2E_BASE_URL=http://localhost:8080 go test -v -run TestDeploymentReady
```

### Run Tests with Verbose Output

```bash
E2E_NAMESPACE=multi-juicer E2E_BASE_URL=http://localhost:8080 go test -v -timeout 15m ./...
```

### Skip Specific Tests

```bash
SKIP_CLEANUP_TEST=true E2E_NAMESPACE=multi-juicer E2E_BASE_URL=http://localhost:8080 go test -v ./...
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_NAMESPACE` | `multi-juicer` | Kubernetes namespace for MultiJuicer |
| `E2E_BASE_URL` | `http://localhost:8080` | Base URL for balancer API |
| `KUBECONFIG` | `~/.kube/config` | Kubernetes config file |
| `SKIP_CLEANUP_TEST` | `false` | Skip cleanup validation test |

## Troubleshooting

### Tests Timeout

Increase timeout:
```bash
go test -v -timeout 20m ./...
```

### Pod Not Ready

Check pod status:
```bash
kubectl get pods -n multi-juicer
kubectl describe pod <pod-name> -n multi-juicer
```

### Connection Refused

Ensure port forwarding is running:
```bash
# In another terminal
kubectl port-forward -n multi-juicer service/juice-balancer 8080:8080
```

### Cluster Issues

Clean up and restart:
```bash
make cleanup
make setup-kind
make install-multi-juicer
```

## Adding New Tests

### 1. Create New Test Method

```go
func (s *E2ETestSuite) testNewFeature(t *testing.T) {
    // Your test code
    assert.Equal(t, expected, actual, "Test description")
}
```

### 2. Register in TestE2EMultiJuicer

```go
t.Run("TestNewFeature", suite.testNewFeature)
```

### 3. Run Tests

```bash
make run-tests
```

## Best Practices

1. **Use Eventually for Async Operations**: Wait for conditions with timeouts
   ```go
   require.Eventually(t, func() bool {
       // Condition
       return isReady
   }, 30*time.Second, 1*time.Second)
   ```

2. **Clean Up Resources**: Each test should clean after itself
   ```go
   defer resp.Body.Close()
   ```

3. **Use Meaningful Assertions**: Clear error messages
   ```go
   assert.Equal(t, expected, actual, "Descriptive error message")
   ```

4. **Test Isolation**: Each test should be independent

## Performance Considerations

- Tests run with `count=1` to prevent caching issues
- Timeout set to 15 minutes for all tests
- Parallel K8s version testing speeds up CI/CD
- Port forwarding uses background process

## Future Enhancements

- [ ] Load testing scenarios
- [ ] Challenge solving simulation
- [ ] Multi-team interaction testing
- [ ] Performance benchmarks
- [ ] Custom metric collection
- [ ] Test data generation for specific scenarios

## Contributing

When adding new tests:

1. Follow existing naming conventions
2. Add comprehensive comments
3. Update this README
4. Test locally before pushing
5. Ensure tests pass across all K8s versions

## Support

For issues or questions:
- Check GitHub issues: #39
- Review logs in GitHub Actions artifacts
- Test locally with `make all`

