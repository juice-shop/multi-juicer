# MultiJuicer Architecture

MultiJuicer is a multi-user platform for running OWASP Juice Shop CTF events and security trainings. The system dynamically creates and manages separate Juice Shop instances for each participating team on a Kubernetes cluster.

## High-Level Overview

MultiJuicer consists of three main components that work together to provide a seamless multi-user Juice Shop experience:

1. **Balancer** - The central component that handles user authentication, instance routing, and score tracking
2. **Progress Watchdog** - Monitors and persists challenge progress across instance restarts
3. **Cleaner** - Removes inactive instances to free up cluster resources

All components run as containerized services within a Kubernetes cluster and communicate via the Kubernetes API and HTTP endpoints.

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

**LLM Gateway (optional)**
- When `config.juiceShop.llm.enabled` is true, the balancer process runs an additional HTTP server on port `:8082` that proxies AI chatbot requests from Juice Shop instances to an upstream OpenAI-compatible API
- Keeps the real LLM API key inside the balancer so it cannot be extracted via Juice Shop RCE challenges
- On team creation, an HMAC-signed team token is stored in a per-team Kubernetes Secret and mounted as `LLM_API_KEY` in the Juice Shop pod; the gateway validates the token via the balancer's signing key, derives the team name, and substitutes the real API key before forwarding the request upstream
- Extracts token usage from both JSON and SSE chat-completion responses and accumulates per-team input/output token counts in memory
- A background flusher periodically writes accumulated usage to the team's deployment annotations (`multi-juicer.owasp-juice.shop/llmInputTokens`, `multi-juicer.owasp-juice.shop/llmOutputTokens`) using optimistic concurrency so multiple balancer replicas can coexist
- Exposed cluster-internally only via the `multijuicer-llm-gateway` ClusterIP service; Juice Shop's `chatBot.llmApiUrl` is automatically rewritten to point at it

**Observability**
- Prometheus metrics endpoint for monitoring HTTP request counts and other metrics
- Structured logging for operational visibility

**Key Packages**
- `routes/` - HTTP handlers for all API endpoints
- `pkg/scoring/` - Score calculation and caching logic
- `pkg/longpoll/` - Unified HTTP long polling implementation
- `pkg/bundle/` - Configuration and shared dependencies
- `pkg/teamcookie/` - Secure cookie management
- `pkg/llmgateway/` - LLM proxy gateway and per-team token usage tracking

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

### Progress Watchdog

The Progress Watchdog is responsible for tracking and persisting challenge progress to ensure continuity across Juice Shop instance restarts.

**Core Responsibilities**

**Webhook Handler**
- Exposes a `/team/{team}/webhook` endpoint that receives notifications from Juice Shop instances when challenges are solved
- Validates incoming webhooks and prevents duplicate challenge recordings
- Normalizes timestamps to UTC to ensure consistent progress tracking

**Progress Persistence**
- Stores challenge progress as JSON annotations on Kubernetes deployment objects
- Maintains a list of solved challenges with their solution timestamps
- Updates deployment annotations immediately when new challenges are solved

**Background Synchronization**
- Runs periodic workers that check Juice Shop instances for progress updates
- Compares persisted progress (in deployment annotations) with current progress from Juice Shop's continue code
- Applies missing progress back to Juice Shop instances after restarts or crashes
- Uses a worker pool (default 10 workers) for concurrent progress synchronization

**Recovery Mechanism**
- When a Juice Shop instance restarts, the watchdog detects the new pod
- Fetches the persisted challenge progress from the deployment annotations
- Restores progress by applying the continue code to the fresh Juice Shop instance
- Ensures teams don't lose progress due to pod crashes or cluster events

**Key Components**
- `internal/progresswatchdog/background-sync.go` - Worker pool and synchronization logic
- `internal/progresswatchdog/kubernetes.go` - Kubernetes API interactions for progress persistence
- `internal/progresswatchdog/compare-progress.go` - Logic for comparing and merging progress states

---

### Cleaner

The Cleaner is a periodic job that removes inactive Juice Shop instances to free up cluster resources.

**Core Responsibilities**

**Instance Activity Monitoring**
- Queries Kubernetes for all Juice Shop deployments using label selectors
- Reads the `multi-juicer.owasp-juice.shop/lastRequest` annotation from each deployment
- Compares the last activity timestamp against a configurable inactivity threshold

**Cleanup Operations**
- Deletes the Kubernetes deployment for inactive instances. The associated Service and (when the LLM gateway is enabled) the per-team LLM token Secret reference the deployment via `OwnerReferences`, so Kubernetes garbage collects them automatically — the cleaner does not need (or have) permission to delete those resources directly
- Configurable inactivity duration via the `MAX_INACTIVE_DURATION` environment variable (e.g., "12h", "30m")
- Provides detailed logging of cleanup operations including success/failure counts
- Gracefully handles edge cases like missing annotations or parse errors

**Operational Mode**
- Typically runs as a Kubernetes CronJob on a scheduled interval
- Executes as a one-shot process: performs cleanup and exits
- Reports summary statistics of deleted deployments and services
- Skips deployments without proper annotations or with invalid timestamps

**Safety Features**
- Only deletes instances that haven't been accessed within the configured threshold
- Checks for the presence and validity of activity annotations before deletion
- Continues processing even if individual deletions fail
- Logs all operations for audit purposes

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
2. Juice Shop sends a webhook to the Progress Watchdog
3. Progress Watchdog validates the webhook and extracts challenge information
4. Progress Watchdog updates the deployment annotation with the new challenge solution
5. Background sync workers periodically verify progress consistency
6. Balancer's scoring service detects the change and recalculates team scores
7. Frontend clients receive score updates via long polling connections

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

1. The Juice Shop chatbot is configured to call the cluster-internal `multijuicer-llm-gateway` service with the team's `LLM_API_KEY` (the signed team token) as a bearer token
2. The LLM gateway running inside the balancer validates the bearer token against the cookie signing key and derives the team name
3. The gateway substitutes the real upstream API key into the request and reverse-proxies it to the configured upstream LLM API
4. For chat completion responses (JSON or SSE), the gateway parses the `usage` field and adds the input/output token counts to an in-memory per-team accumulator
5. A periodic flusher writes the accumulated counts to the team's deployment annotations using optimistic concurrency (retry on conflict), then resets the in-memory counters

### Instance Cleanup

1. Cleaner CronJob starts on schedule
2. Queries all Juice Shop deployments from Kubernetes
3. Checks each deployment's last activity timestamp
4. Deletes the Juice Shop instances that exceed the inactivity threshold
5. Reports cleanup summary and exits

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

### Progress Watchdog ↔ Kubernetes
- Reads and writes deployment annotations for progress persistence
- Lists and watches deployments to detect new instances requiring synchronization
- Updates deployment annotations when challenges are solved

### Progress Watchdog ↔ Juice Shop Instances
- Receives webhooks when challenges are solved
- Queries Juice Shop's continue code API to fetch current progress
- Applies continue codes to restore progress after restarts

### Cleaner ↔ Kubernetes
- Lists deployments with specific label selectors
- Reads deployment annotations for activity timestamps
- Deletes inactive Juice Shop deployments. The matching Service and (when present) Secrets are owned by the deployment via `OwnerReferences` and garbage collected by Kubernetes

### Frontend ↔ Balancer Backend
- HTTP API calls for team management and data retrieval
- Long polling connections for real-time score and status updates
- Cookie-based session management for authentication

---

## Deployment Architecture

All components are deployed as Kubernetes resources:

- **Balancer**: Deployment with multiple replicas behind a LoadBalancer/Ingress service. When the LLM gateway is enabled, the same pods also exposes the gateway on port `:8082` via the cluster-internal `multijuicer-llm-gateway` ClusterIP service
- **Progress Watchdog**: Single deployment (no need for multiple replicas)
- **Cleaner**: CronJob running on a scheduled interval deleting inactive Juice Shop instances
- **Juice Shop Instances**: Individual deployments and services per team

The entire stack is typically deployed via Helm charts, which handle all Kubernetes resource creation, configuration, and lifecycle management.

---

## Configuration

Each component is configured via environment variables and Kubernetes ConfigMaps:

All configuration is managed through Helm values, allowing easy customization for different deployment scenarios.
