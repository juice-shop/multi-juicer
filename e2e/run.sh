#!/usr/bin/env bash
set -euo pipefail

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd "$repo_dir"

for tool in docker kind kubectl helm yq go curl timeout; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing E2E prerequisite: $tool (see CONTRIBUTING.md)" >&2
    exit 1
  fi
done
docker info >/dev/null
docker buildx version >/dev/null
platform=$(docker version --format '{{.Server.Os}}/{{.Server.Arch}}')

run_id="$(date +%s)-$$"
cluster_name="multi-juicer-e2e-$run_id"
test_image="local/multi-juicer:e2e-$run_id"
work_dir=$(mktemp -d)
export KUBECONFIG="$work_dir/kubeconfig"
export KIND_EXPERIMENTAL_PROVIDER=docker
export E2E_NAMESPACE=multi-juicer-e2e
export E2E_ADMIN_PASSWORD=multi-juicer-e2e-admin
export E2E_BASE_URL=
export E2E_ARTIFACT_DIR="${E2E_ARTIFACT_DIR:-$repo_dir/e2e/artifacts/$run_id}"
mkdir -p "$E2E_ARTIFACT_DIR"
node_image=${KIND_NODE_IMAGE:-kindest/node:v1.37.0@sha256:a1ed56cfb0e7b93589bdf97c8cd566405a265939e3620fc4f5de89adff580ae5}
forward_pid=
cluster_started=false
image_built=false

diagnostics() {
  timeout 60s kind export logs "$E2E_ARTIFACT_DIR/kind" --name "$cluster_name" || true
  kubectl --request-timeout=15s get nodes -o wide >"$E2E_ARTIFACT_DIR/nodes.log" 2>&1 || true
  kubectl --request-timeout=15s -n "$E2E_NAMESPACE" get deployments,replicasets,pods,services -o wide >"$E2E_ARTIFACT_DIR/resources.log" 2>&1 || true
  kubectl --request-timeout=15s -n "$E2E_NAMESPACE" get events --sort-by=.metadata.creationTimestamp >"$E2E_ARTIFACT_DIR/events.log" 2>&1 || true
  kubectl --request-timeout=15s -n "$E2E_NAMESPACE" describe pods >"$E2E_ARTIFACT_DIR/pods.log" 2>&1 || true
  timeout 30s kubectl -n "$E2E_NAMESPACE" logs -l app.kubernetes.io/part-of=multi-juicer --all-containers=true --prefix --tail=500 >"$E2E_ARTIFACT_DIR/containers.log" 2>&1 || true
}

cleanup() {
  local result=$?
  trap - EXIT INT TERM
  if [[ $result -ne 0 && $cluster_started == true ]]; then
    diagnostics
  fi
  if [[ -n $forward_pid ]]; then
    kill "$forward_pid" 2>/dev/null || true
    wait "$forward_pid" 2>/dev/null || true
  fi
  if [[ $cluster_started == true ]]; then
    if ! timeout 90s kind delete cluster --name "$cluster_name"; then
      echo "Failed to remove E2E cluster: $cluster_name" >&2
      result=1
    fi
  fi
  if [[ $image_built == true ]]; then
    docker image rm "$test_image" >/dev/null || true
  fi
  rm -f -- "$KUBECONFIG" "$work_dir/images.tar"
  rmdir -- "$work_dir"
  echo "E2E output: $E2E_ARTIFACT_DIR"
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

juice_shop_version=$(yq -er '.config.juiceShop.tag' helm/multi-juicer/values.yaml)
juice_shop_repository=$(yq -er '.config.juiceShop.image' helm/multi-juicer/values.yaml)
juice_shop_image="$juice_shop_repository:$juice_shop_version"

echo "Building $test_image with Juice Shop $juice_shop_version"
docker build --platform "$platform" --progress=plain --build-arg "JUICE_SHOP_VERSION=$juice_shop_version" -t "$test_image" . 2>&1 | tee "$E2E_ARTIFACT_DIR/build.log"
image_built=true
docker pull --platform "$platform" "$juice_shop_image" 2>&1 | tee "$E2E_ARTIFACT_DIR/juice-shop-image.log"
# Export only this platform: Docker's containerd store can otherwise include
# references to undownloaded platforms that kind cannot import.
# https://kind.sigs.k8s.io/docs/user/known-issues/#unable-to-kind-load-docker-images
docker image save --platform "$platform" --output "$work_dir/images.tar" "$test_image" "$juice_shop_image"

echo "Creating $cluster_name with $node_image"
cluster_started=true
kind create cluster --name "$cluster_name" --kubeconfig "$KUBECONFIG" --image "$node_image" --wait 120s --retain 2>&1 | tee "$E2E_ARTIFACT_DIR/cluster.log"
kubectl wait --for=condition=Ready nodes --all --timeout=120s
kind load image-archive --name "$cluster_name" "$work_dir/images.tar" 2>&1 | tee "$E2E_ARTIFACT_DIR/image-load.log"
rm -f -- "$work_dir/images.tar"

helm upgrade --install multi-juicer ./helm/multi-juicer \
  --namespace "$E2E_NAMESPACE" --create-namespace \
  --set-string repository=local/multi-juicer \
  --set-string "tag=e2e-$run_id" \
  --set-string imagePullPolicy=Never \
  --set-string "adminPassword=$E2E_ADMIN_PASSWORD" \
  --set-string cookie.cookieParserSecret=multi-juicer-e2e-cookie-key \
  --wait --timeout 5m 2>&1 | tee "$E2E_ARTIFACT_DIR/helm.log"

# Let kubectl choose a free loopback port so concurrent local runs do not clash.
kubectl -n "$E2E_NAMESPACE" port-forward --address=127.0.0.1 service/multi-juicer :8080 >"$E2E_ARTIFACT_DIR/port-forward.log" 2>&1 &
forward_pid=$!
for ((attempt = 0; attempt < 60; attempt++)); do
  if ! kill -0 "$forward_pid" 2>/dev/null; then
    cat "$E2E_ARTIFACT_DIR/port-forward.log" >&2
    exit 1
  fi
  port=$(sed -n 's/^Forwarding from 127\.0\.0\.1:\([0-9]*\) -> .*/\1/p' "$E2E_ARTIFACT_DIR/port-forward.log" | head -1)
  if [[ -n $port ]] && curl --fail --silent --max-time 2 "http://127.0.0.1:$port/multi-juicer/api/readiness" >/dev/null; then
    export E2E_BASE_URL="http://127.0.0.1:$port"
    break
  fi
  sleep 1
done
if [[ -z ${E2E_BASE_URL:-} ]]; then
  echo "Timed out waiting for the MultiJuicer port-forward" >&2
  cat "$E2E_ARTIFACT_DIR/port-forward.log" >&2
  exit 1
fi

go test -tags=e2e -count=1 -timeout=15m -v ./e2e "$@" 2>&1 | tee "$E2E_ARTIFACT_DIR/tests.log"
