# Contributing to MultiJuicer

Thanks for your interest in contributing! This guide covers getting MultiJuicer running on your machine and using the project's task runner to develop, test, and lint.

For an overview of how the codebase is structured and how the components fit together, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Required Tools

You'll need the following installed locally before working on MultiJuicer:

- **[Task](https://taskfile.dev/installation/)** — task runner used to drive all dev/test/lint commands
- **[Go](https://go.dev/doc/install)** (matching the version in [`go.mod`](./go.mod)) — backend services
- **[Node.js](https://nodejs.org/)** with [npm](https://docs.npmjs.com/) (or optionally [Bun](https://bun.sh/) for faster UI tests) — frontend toolchain
- **[Docker](https://docs.docker.com/get-docker/)** — builds the component images
- **A local Kubernetes cluster** sharing Docker's image cache, e.g. [Docker Desktop's built-in cluster](https://docs.docker.com/desktop/features/kubernetes/) or [kind - recommended](https://kind.sigs.k8s.io/docs/user/quick-start/)
- **[kubectl](https://kubernetes.io/docs/tasks/tools/)** — talks to the cluster
- **[Helm](https://helm.sh/docs/intro/install/)** — installs MultiJuicer into the cluster
- **[helm unittest plugin](https://github.com/helm-unittest/helm-unittest)** — runs the Helm chart tests (`helm plugin install https://github.com/helm-unittest/helm-unittest.git`)
- **[semgrep](https://semgrep.dev/docs/getting-started/)** — static analysis run as part of `task test`

Optional:

- **[helm-docs](https://github.com/norwoodj/helm-docs)** — regenerates Helm chart docs (`task helm:docs`)

## Running MultiJuicer Locally

Make sure your `kubectl` context points at your local cluster.

```sh
task dev
```

This runs [`task build-and-deploy`](./Taskfile.yaml), waits for the multi-juicer rollout, and forwards `deployment/multi-juicer` to port 8080. You can now access MultiJuicer at `http://localhost:8080`.

Re-run `task dev` after code changes to rebuild and redeploy. All builds (Go and UI) happen inside Docker, so you don't need a local Go or Node toolchain just to run `task dev`. The builds are cached inside Docker, so subsequent runs should be faster.

## Running Tests

```sh
task test
```

This runs the Helm chart unit tests, UI tests (Bun if installed, otherwise Node.js), Go tests with coverage, and a semgrep scan.

### Kubernetes End-to-End Tests

```sh
task test:e2e
```

This builds the current checkout, installs its Helm chart in a disposable kind cluster, and tests team creation, login/logout, Juice Shop proxying, instance isolation, and admin deletion with Kubernetes garbage collection. It uses real Juice Shop instances. The E2E suite is opt-in and is not included in `task test` or ordinary `go test ./...` runs.

The runner requires Docker 28+ with Buildx, Go (matching `go.mod`), kind 0.33.0, kubectl, Helm 4.3.0, [Mike Farah's yq v4](https://github.com/mikefarah/yq), curl, Bash, and GNU `timeout` (coreutils). Task is optional: `bash e2e/run.sh` runs the same suite. Node.js dependencies are built inside Docker. Images are exported for the Docker server's platform before loading into kind, avoiding incomplete multi-platform archives with Docker's containerd image store.

By default it tests Kubernetes 1.37.0. Set `KIND_NODE_IMAGE` to a version and digest from the [kind 0.33.0 release](https://github.com/kubernetes-sigs/kind/releases/tag/v0.33.0) to test another version, and use a matching kubectl version. CI runs Kubernetes 1.34.11, 1.35.8, 1.36.4, and 1.37.0 independently.

Each run uses its own cluster and temporary kubeconfig and forwards the service on a free `127.0.0.1` port. The runner removes its cluster, image tag, and port-forward on exit. Logs are retained under `e2e/artifacts/<run>/`; set `E2E_ARTIFACT_DIR` to choose another directory. Failed runs also collect cluster logs, workload descriptions, and events before cleanup. CI uploads these diagnostics as an artifact.

## Linting

```sh
task lint
```

Runs `go fmt`, `go fix`, `go vet`, `staticcheck`, and the UI linter. Use `task lint:fix` to auto-fix what the linters can.

## Other Useful Tasks

Run `task --list` to see everything available. A few highlights:

- `task build` — build the UI bundle
- `task helm:test:update-snapshots` — refresh Helm test snapshots after intentional chart changes
- `task ui:bundle-analyzer` — visualize the UI bundle
