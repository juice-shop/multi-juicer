# MultiJuicer Architecture

MultiJuicer is a multi-user platform for running OWASP Juice Shop CTF events and security trainings. The system dynamically creates and manages separate Juice Shop instances for each participating team on a Kubernetes cluster.

## High-Level Overview

MultiJuicer ships as a single Go binary, the **Balancer**, which provides the full platform:

- HTTP frontend, scoreboard, and admin API for end users and organizers
- Per-team Juice Shop instance lifecycle (create, route, restart, delete)
- Webhook receiver that records challenge solutions sent by Juice Shop pods
- Background reconciliation loop that re-applies solved-challenge progress after pod restarts
- Periodic cleanup of inactive Juice Shop deployments
- Optional LLM gateway for proxying chatbot requests to an upstream OpenAI-compatible API

When the balancer runs with multiple replicas, **leader election** (via a Kubernetes `Lease`) ensures the background reconciliation loop and the cleanup sweep run on exactly one replica at a time, while every replica continues to serve user-facing traffic and incoming webhooks.

---

## Component Details

### Balancer

The Balancer is the core component of MultiJuicer, serving both as a web application and an API gateway. It consists of two main parts: a Go backend server and a React-based web frontend.

#### Backend (Go)

The backend server is responsible for:

**Instance Management**
- Creates new Juice Shop Kubernetes deployments and services on-demand when teams join
- Routes incoming HTTP traffic to the appropriate team's Juice Shop instance
- Maintains session state using secure, signed cookies to associate users with their team instances
- Tracks instance activity through annotations on Kubernetes deployments

**Authentication & Authorization**
- Handles team registration and login via the `/balancer/api/teams/{team}/join` endpoint
- Supports team passcode management and reset functionality
- Provides an admin interface for managing instances across all teams

**Scoring System**
- Continuously monitors and calculates scores for all teams by querying Juice Shop challenge progress
- Implements a caching layer with automatic updates to optimize score calculations
- Provides HTTP long polling endpoints for real-time score updates to clients
- Tracks solved challenges, positions, and maintains a global leaderboard

**API Endpoints**
- RESTful API for team management, authentication, and score retrieval
- Long polling endpoints for efficient real-time updates:
  - `/balancer/api/score-board/top` - Global leaderboard with top teams
  - `/balancer/api/teams/status` - Current logged-in team's detailed status (requires authentication)
  - `/balancer/api/teams/{team}/status` - Any team's detailed status including solved challenges, position, and instance readiness
  - `/balancer/api/activity-feed` - Recent challenge solutions across all teams (15 most recent events)
- Admin endpoints for instance management (list, delete, restart)
- Health and readiness probes for Kubernetes orchestration

**Internal Port (`:8082`)**
- The balancer pod always exposes a cluster-internal HTTP listener on `:8082`, fronted by the `multijuicer-private` ClusterIP service. The public `balancer` Service only forwards `:8080`, so traffic on `:8082` cannot reach the cluster from outside
- It always serves `POST /team/{team}/webhook`, the endpoint Juice Shop pods call when a challenge is solved
- When `config.juiceShop.llm.enabled` is true, the same listener also acts as a catch-all LLM gateway: it proxies AI chatbot requests from Juice Shop instances to an upstream OpenAI-compatible API and keeps the real LLM API key inside the balancer process so it cannot be extracted via Juice Shop RCE challenges
- On team creation, an HMAC-signed team token is stored in a per-team Kubernetes Secret and mounted as `LLM_API_KEY` in the Juice Shop pod; the gateway validates the token via the balancer's signing key, derives the team name, and substitutes the real API key before forwarding the request upstream
- Extracts token usage from both JSON and SSE chat-completion responses and accumulates per-team input/output token counts in memory
- A background flusher periodically writes accumulated usage to the team's deployment annotations (`multi-juicer.owasp-juice.shop/llmInputTokens`, `multi-juicer.owasp-juice.shop/llmOutputTokens`) using optimistic concurrency so multiple balancer replicas can coexist

**Progress Reconciliation**
- Webhooks received on the internal port are persisted as JSON annotations on the team's deployment. The handler is idempotent and runs on every replica
- A leader-only background loop lists every Juice Shop deployment every 60 seconds, fetches the live challenge state, compares it with the persisted state, and re-applies the saved continue code when the live state has regressed (e.g. after a pod restart). 10 worker goroutines drain the queue concurrently
- Implemented in `internal/progresswatchdog/` with the route handler in `internal/routes/private/webhook.go`

**Inactive-Instance Cleanup**
- A leader-only ticker (default 1 minute) lists Juice Shop deployments and deletes the ones whose `multi-juicer.owasp-juice.shop/lastRequest` annotation exceeds the configured inactivity threshold (`config.juiceShop.deleteInactiveAfter`, default `24h`)
- The matching Service and (when LLM is enabled) Secret are owned by the deployment via `OwnerReferences` and are garbage-collected automatically
- Implemented in `internal/cleaner/`

**Leader Election**
- Singleton background work (progress reconciliation, cleanup) is gated by a Kubernetes `Lease` named `multi-juicer-balancer-leader` in the release namespace via `client-go`'s `leaderelection` package
- Identity is the pod name (downward API `POD_NAME`); lease parameters: 30s lease, 20s renew, 5s retry
- Only the leader runs the reconciliation worker pool and the cleanup ticker; followers continue to serve user-facing HTTP and webhooks. When leadership is lost the contexts are cancelled so the goroutines unwind cleanly

**Observability**
- Prometheus metrics endpoint for monitoring HTTP request counts and other metrics
- Structured logging for operational visibility

**Key Packages**
- `internal/routes/public/` - HTTP handlers for the public `:8080` API
- `internal/routes/private/` - HTTP handlers for the cluster-internal `:8082` listener (`/team/{team}/webhook` and the optional LLM gateway mount)
- `internal/scoring/` - Score calculation and caching logic
- `internal/longpoll/` - Unified HTTP long polling implementation
- `internal/bundle/` - Configuration and shared dependencies
- `internal/teamcookie/` - Secure cookie management
- `internal/llmgateway/` - LLM proxy gateway and per-team token usage tracking
- `internal/progresswatchdog/` - Background reconciliation of Juice Shop challenge progress
- `internal/cleaner/` - Periodic deletion of inactive Juice Shop deployments
- `internal/leader/` - Lease-based leader election wrapper for the singleton background loops

#### Frontend (React/TypeScript)

The web frontend provides a user-friendly interface for participants and organizers:

**User Features**
- Team join/login interface with passcode management
- Real-time scoreboard with automatic updates via HTTP long polling
- Individual team score pages showing solved challenges and progress
- Team status dashboard displaying instance readiness and current ranking
- Challenge detail pages showing which teams have solved specific challenges
- Live activity feed showing recent challenge solutions across all teams

**Admin Features**
- Overview of all active instances with their status
- Ability to restart or delete team instances
- Monitoring of team activity and progress

**Technical Implementation**
- Built with React, TypeScript, and Vite for fast development and production builds
- Uses React Router for client-side routing
- Custom hooks for managing long polling connections:
  - `useHttpLongPoll` - Generic HTTP long polling implementation
  - `useScoreboard` - Fetches global leaderboard with top teams
  - `useTeamStatus` - Fetches team status (supports both current user and specific teams)
  - `useActivityFeed` - Fetches recent activity feed events
- Framer Motion for smooth animations and transitions
- Tailwind CSS for styling
- Internationalization support via react-intl

**Key Directories**
- `ui/src/pages/` - Main page components (ScoreOverview, TeamDetail, TeamStatus, etc.)
- `ui/src/hooks/` - Custom React hooks for data fetching and long polling
- `ui/src/components/` - Reusable UI components
- `ui/src/translations/` - Internationalization files

---

## Data Flow

### Team Joins and Instance Creation

1. User accesses the Balancer web interface
2. User submits team name and passcode to the join endpoint
3. Balancer validates credentials and creates a Kubernetes deployment/service for the team
4. If the LLM gateway is enabled, Balancer also creates a per-team Kubernetes Secret containing an HMAC-signed team token, which is mounted into the Juice Shop pod as `LLM_API_KEY`
5. Balancer sets a signed cookie associating the user with their team
6. User is redirected to their team's Juice Shop instance via the Balancer proxy

### Challenge Solution Tracking

1. User solves a challenge in their Juice Shop instance
2. Juice Shop sends a webhook to `http://multijuicer-private.{ns}.svc.cluster.local:8082/team/{team}/webhook` (any balancer replica handles it)
3. The webhook handler validates the payload and patches the new solution onto the team's deployment annotation
4. The leader-only background sync loop periodically reconciles persisted progress with live Juice Shop state, re-applying continue codes if a pod restarted with empty progress
5. The scoring service detects the annotation change and recalculates team scores
6. Frontend clients receive score updates via long polling connections

### Score Display and Updates

1. Frontend establishes long polling connections to score and activity feed endpoints
2. Balancer's scoring service calculates scores by querying all team deployments
3. When scores change, waiting long poll requests receive immediate responses
4. Clients display updated scores and activity feed, then re-establish long polling connections
5. Process repeats to provide real-time updates with minimal server overhead

### Activity Feed Updates

1. Frontend establishes a long polling connection to `/balancer/api/activity-feed`
2. Server returns the 30 most recent challenge solve events with team names, challenge details, and timestamps
3. When new challenges are solved (scores update), the long poll request completes with fresh activity data
4. Frontend displays the new activity in the live activity sidebar
5. Client automatically re-establishes the long polling connection with the last update timestamp
6. If no updates occur within 25 seconds, server returns 204 No Content and client retries

### LLM Chatbot Requests (when enabled)

1. The Juice Shop chatbot is configured to call the cluster-internal `multijuicer-private` service with the team's `LLM_API_KEY` (the signed team token) as a bearer token
2. The LLM gateway running inside the balancer validates the bearer token against the cookie signing key and derives the team name
3. The gateway substitutes the real upstream API key into the request and reverse-proxies it to the configured upstream LLM API
4. For chat completion responses (JSON or SSE), the gateway parses the `usage` field and adds the input/output token counts to an in-memory per-team accumulator
5. A periodic flusher writes the accumulated counts to the team's deployment annotations using optimistic concurrency (retry on conflict), then resets the in-memory counters

### Instance Cleanup

1. The leader balancer's cleanup ticker fires (default every 1 minute)
2. It lists all Juice Shop deployments from Kubernetes
3. For each, it compares the `multi-juicer.owasp-juice.shop/lastRequest` annotation against the configured grace period
4. Inactive deployments are deleted; their Services and per-team Secrets are garbage-collected automatically via `OwnerReferences`

---

## Inter-Component Communication

### Balancer ↔ Kubernetes
- Creates/deletes deployments and services for team instances
- Reads deployment annotations to track challenge progress and calculate scores
- Updates deployment annotations to record instance activity timestamps
- When the LLM gateway is enabled, also creates per-team Secrets holding signed LLM tokens and updates deployments with accumulated LLM token usage annotations

### Balancer LLM Gateway ↔ Upstream LLM API (when enabled)
- Reverse-proxies OpenAI-compatible requests from Juice Shop instances to the configured upstream API
- Substitutes the real API key (held only in the balancer process) into outgoing requests
- Parses chat-completion responses (JSON and SSE) to attribute token usage back to the requesting team

### Balancer ↔ Juice Shop Instances
- Receives challenge-solved webhooks from Juice Shop pods on the cluster-internal `:8082` listener
- Queries Juice Shop's continue code API from the leader's reconciliation loop to fetch current progress
- Applies continue codes to restore progress after restarts

### Frontend ↔ Balancer Backend
- HTTP API calls for team management and data retrieval
- Long polling connections for real-time score and status updates
- Cookie-based session management for authentication

---

## Deployment Architecture

The chart deploys two kinds of long-running workloads:

- **Balancer**: Deployment (1+ replicas) behind a LoadBalancer/Ingress Service on `:8080` for end-user traffic. The same pods also expose `:8082` via the cluster-internal `multijuicer-private` ClusterIP Service for solution webhooks and (when enabled) the LLM gateway. Singleton background work (progress reconciliation, cleanup) is gated by a `Lease`-based leader election so multi-replica deployments don't duplicate it
- **Juice Shop Instances**: Individual Deployments and Services per team, created on demand by the balancer

The entire stack is deployed via the Helm chart in `helm/multi-juicer/`, which handles Kubernetes resource creation, configuration, and lifecycle management.

---

## Configuration

Each component is configured via environment variables and Kubernetes ConfigMaps:

All configuration is managed through Helm values, allowing easy customization for different deployment scenarios.
