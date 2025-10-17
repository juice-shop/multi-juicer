.PHONY: help setup-kind install-multi-juicer run-tests cleanup all port-forward

CLUSTER_NAME := multi-juicer-e2e
K8S_VERSION := v1.28.0
NAMESPACE := multi-juicer

help:
	@echo "E2E Test Commands:"
	@echo "  make setup-kind           - Create KinD cluster"
	@echo "  make install-multi-juicer - Install MultiJuicer"
	@echo "  make run-tests            - Run E2E tests"
	@echo "  make port-forward         - Setup port forwarding"
	@echo "  make cleanup              - Delete KinD cluster"
	@echo "  make all                  - Run complete E2E test suite"

setup-kind:
	@echo "Creating KinD cluster with version $(K8S_VERSION)..."
	kind create cluster --name $(CLUSTER_NAME) --image kindest/node:$(K8S_VERSION) --config kind-config.yaml
	@echo "Installing NGINX Ingress controller..."
	kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
	kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=90s
	@echo "KinD cluster ready!"

install-multi-juicer:
	@echo "Building Docker images..."
	cd ../../balancer && docker build -t juice-balancer:local .
	cd ../../cleaner && docker build -t juice-cleaner:local .
	cd ../../progress-watchdog && docker build -t juice-progress-watchdog:local .
	@echo "Loading images into KinD..."
	kind load docker-image juice-balancer:local --name $(CLUSTER_NAME)
	kind load docker-image juice-cleaner:local --name $(CLUSTER_NAME)
	kind load docker-image juice-progress-watchdog:local --name $(CLUSTER_NAME)
	@echo "Installing MultiJuicer with Helm..."
	helm install multi-juicer ../../helm/multi-juicer \
		--create-namespace \
		--namespace $(NAMESPACE) \
		--set="imagePullPolicy=Never" \
		--set="balancer.repository=juice-balancer" \
		--set="balancer.tag=local" \
		--set="progressWatchdog.repository=juice-progress-watchdog" \
		--set="progressWatchdog.tag=local" \
		--set="cleaner.repository=juice-cleaner" \
		--set="cleaner.tag=local" \
		--wait --timeout 5m
	@echo "Waiting for deployments..."
	kubectl wait --for=condition=available --timeout=300s deployment/juice-balancer -n $(NAMESPACE) || true
	kubectl wait --for=condition=available --timeout=300s deployment/progress-watchdog -n $(NAMESPACE) || true
	sleep 10
	@echo "MultiJuicer installed!"

port-forward:
	@echo "Setting up port forwarding on port 8080..."
	kubectl port-forward -n $(NAMESPACE) service/juice-balancer 8080:8080

run-tests:
	@echo "Running E2E tests..."
	E2E_NAMESPACE=$(NAMESPACE) E2E_BASE_URL=http://localhost:8080 go test -v -timeout 15m -count=1 ./...

cleanup:
	@echo "Cleaning up KinD cluster..."
	kind delete cluster --name $(CLUSTER_NAME)
	@echo "Cleanup complete!"

all: setup-kind install-multi-juicer port-forward run-tests
	@echo "E2E tests completed!"

.PHONY: logs
logs:
	@echo "=== Deployment Status ==="
	kubectl get deployments -n $(NAMESPACE)
	@echo "\n=== Pod Status ==="
	kubectl get pods -n $(NAMESPACE)
	@echo "\n=== Balancer Logs ==="
	kubectl logs -n $(NAMESPACE) deployment/juice-balancer --tail=100
