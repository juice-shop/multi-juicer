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
