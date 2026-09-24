# Example Setup with Hetzner Cloud

This guide sets up a MultiJuicer cluster on [Hetzner Cloud](https://www.hetzner.com/cloud), supporting both **single-VM** deployments (sized for ~20–70 teams) and **multi-VM clusters** (supporting 100, 150, 200+ teams), reachable over **HTTPS** on your own domain with automated Let's Encrypt certificates. The domain stays at your existing DNS provider — you just point a single `A` record at the control-plane VM's public IP.

The setup is intentionally throw-away: after the event you delete all resources with a single command and pay nothing more. Two scripts manage the entire lifecycle:

- [`setup.sh`](./setup.sh) — provisions everything from scratch (single-VM or multi-VM)
- [`teardown.sh`](./teardown.sh) — deletes every Hetzner resource created by `setup.sh` (servers, private network, firewall, SSH key)

> Expected costs: The default single-VM type (`cpx32`, 4 vCPU / 8 GB RAM / 80 GB SSD) costs ~€0.07/h on Hetzner Cloud capped at ~€42/month. Run `teardown.sh` when you no longer need it.

---

## Architecture & VM Sizing Recommendations

### Single-VM vs. Multi-VM Clusters

- **Single-VM (`WORKER_COUNT=0`)**: Ideal for events with up to ~70 teams. The control plane runs `k3s`, Traefik, MultiJuicer balancer replicas, and all JuiceShop instances on a single VM.
- **Multi-VM Cluster (`WORKER_COUNT > 0`)**: Essential for 100, 150, 200+ teams. Standard Kubernetes (`k3s`) enforces a default ceiling of **110 pods per node**. To host >70 instances without risking pod scheduling limits, CPU starvation, or memory exhaustion during intense challenge solving / brute-forcing, worker nodes are connected over a secure, free **Hetzner Cloud Private Network** (`10.0.0.0/16`).
  - **Ingress & Networking**: Your DNS `A` record always points **exclusively to the control-plane public IP**. Traefik terminates TLS (Let's Encrypt HTTP-01) on the control plane and proxies traffic to JuiceShop pods running across worker nodes via k3s Flannel CNI over the private network. No expensive cloud load balancer is needed.

### Sizing Matrix

All recommendations strictly use Hetzner `cpx32` (4 vCPU, 8 GB RAM), `cpx42` (8 vCPU, 16 GB RAM), and `cpx52` (16 vCPU, 32 GB RAM) instances. For multi-VM setups (100+ teams), clusters use 1 × `cpx52` worker VM per 50 teams:

| Capacity | Control Plane (`SERVER_TYPE`) | Worker Nodes (`WORKER_TYPE` & `WORKER_COUNT`) | Configuration |
| :--- | :--- | :--- | :--- |
| **20 teams (default)** | `cpx32` | *None (single-VM)* | `SERVER_TYPE=cpx32`, `MAX_INSTANCES=20`, `WORKER_COUNT=0`, `REPLICAS=2` |
| **40 teams** | `cpx42` | *None (single-VM)* | `SERVER_TYPE=cpx42`, `MAX_INSTANCES=40`, `WORKER_COUNT=0`, `REPLICAS=2` |
| **70 teams** | `cpx52` | *None (single-VM)* | `SERVER_TYPE=cpx52`, `MAX_INSTANCES=70`, `WORKER_COUNT=0`, `REPLICAS=2` |
| **100 teams** | `cpx32` | 2 × `cpx52` | `SERVER_TYPE=cpx32`, `WORKER_TYPE=cpx52`, `WORKER_COUNT=2`, `MAX_INSTANCES=100`, `REPLICAS=3` |
| **150 teams** | `cpx32` | 3 × `cpx52` | `SERVER_TYPE=cpx32`, `WORKER_TYPE=cpx52`, `WORKER_COUNT=3`, `MAX_INSTANCES=150`, `REPLICAS=3` |
| **200 teams** | `cpx32` | 4 × `cpx52` | `SERVER_TYPE=cpx32`, `WORKER_TYPE=cpx52`, `WORKER_COUNT=4`, `MAX_INSTANCES=200`, `REPLICAS=3` |

---

## What the script creates

| Resource | Where | Purpose |
| :--- | :--- | :--- |
| **SSH key** (`ed25519`) | local + Hetzner Cloud | Login key for all provisioned VMs |
| **Firewall** (`multi-juicer-fw`) | Hetzner Cloud | Allows inbound tcp/22, tcp/80, tcp/443 (world) and tcp/6443 (k8s API, restricted to your public IP) |
| **Private Network** (`multi-juicer-net`) | Hetzner Cloud | Private interconnect (`10.0.0.0/16`) for intra-cluster communication (created when `WORKER_COUNT > 0`) |
| **Server** (`multi-juicer`) | Hetzner Cloud | Control-plane VM running `k3s server`, Traefik ingress, and MultiJuicer balancer |
| **Worker Servers** (`multi-juicer-worker-1..N`) | Hetzner Cloud | Worker VMs running `k3s agent` hosting JuiceShop pods (created when `WORKER_COUNT > 0`) |
| **k3s (with bundled Traefik)** | on VMs | Lightweight Kubernetes cluster + Traefik ingress controller |
| **Traefik ACME certResolver** | in-cluster | Traefik's built-in Let's Encrypt client (HTTP-01, persistent `acme.json`) |
| **MultiJuicer Helm release** | in-cluster | The MultiJuicer balancer (2–3 replicas) + on-demand JuiceShop instances |
| **LLM gateway secret** (optional) | in-cluster | Holds the upstream LLM API key for the JuiceShop chatbot / AI challenges (only created when `LLM_API_KEY` is set) |

The `A` record for `DOMAIN` stays at your existing DNS provider and is managed by you. `setup.sh` already applies the recommendations from [`guides/production-notes/production-notes.md`](../production-notes/production-notes.md) (secure cookie, persistent `cookieParserSecret` stored in `./.multi-juicer-hetzner/cookie-parser-secret`, multiple balancer replicas, `config.maxInstances`).

---

## Prerequisites

1. A domain you control at any DNS provider — you only need to add a single `A` record to it.
2. A Hetzner Cloud API token with read/write access — [create one here](https://console.hetzner.cloud/) under `Security > API Tokens`.
3. CLI tools on your `PATH`: [`hcloud`](https://github.com/hetznercloud/cli), [`kubectl`](https://kubernetes.io/docs/tasks/tools/), [`helm`](https://helm.sh), plus `ssh`, `ssh-keygen`, `curl`, `jq`, `openssl`.

> Windows users: run the scripts from **WSL** or **Git Bash**. Native PowerShell will not execute `bash` scripts.

---

## Step 1. Configure the environment and start the setup

Set the required variables. Choose between a single-VM setup (default) or a multi-VM setup depending on your expected team count.

### Example A: Single-VM Setup (~20 Teams Default)

```bash
export HCLOUD_TOKEN="<your hetzner cloud api token>"
export DOMAIN="juicy.example.com"    # any subdomain of a domain you control
export EMAIL="you@example.com"       # used for Let's Encrypt registration

# Optional overrides for single-VM:
# export SERVER_TYPE=cpx32           # cpx32 (20 teams), cpx42 (40 teams), or cpx52 (70 teams)
# export MAX_INSTANCES=20            # match with SERVER_TYPE
# export REPLICAS=2                  # MultiJuicer balancer replicas
# export SERVER_LOCATION=nbg1        # nbg1 | fsn1 | hel1 | ash | hil | sin
# export DNS_TIMEOUT=1800            # seconds to wait for DNS to propagate
# export ADMIN_CIDR=1.2.3.4/32       # CIDR allowed to reach k8s API (tcp/6443); defaults to your public IP
# export ADMIN_CIDR_RESET=1          # On re-run, replace admin CIDRs instead of appending

cd guides/hetzner
./setup.sh
```

### Example B: Multi-VM Setup (e.g. 100 / 150 / 200 Teams)

```bash
export HCLOUD_TOKEN="<your hetzner cloud api token>"
export DOMAIN="juicy.example.com"
export EMAIL="you@example.com"

# Multi-VM cluster settings:
export SERVER_TYPE="cpx32"           # Control plane VM
export WORKER_TYPE="cpx52"           # Worker VMs (1x cpx52 per 50 teams)
export REPLICAS=3                    # 3 balancer replicas recommended for multi-node

# Select instance count & worker count:
# For 100 teams:
export WORKER_COUNT=2
export MAX_INSTANCES=100

# For 150 teams:
# export WORKER_COUNT=3
# export MAX_INSTANCES=150

# For 200 teams:
# export WORKER_COUNT=4
# export MAX_INSTANCES=200

# Optional: enable the LLM gateway so the JuiceShop chatbot / AI challenges work.
# See guides/llm/llm.md for background.
# export LLM_API_KEY="sk-..."
# export LLM_MODEL="inclusionai/ling-3.0-flash-fin:free"
# export LLM_API_URL="https://openrouter.ai/api/v1"

cd guides/hetzner
./setup.sh
```

The script first provisions the SSH key, firewall, private network (if `WORKER_COUNT > 0`), and control-plane server, then **pauses** and prints the VM's public IPv4:

```
Create an A record at your DNS provider before continuing:

    Host / Name:  juicy.example.com
    Type:         A
    Value / IPv4: 203.0.113.42
    TTL:          as low as your provider allows (e.g. 300 s / 1 min)
```

Leave the script running while continuing with [Step 2](#step-2-create-the-a-record-at-your-dns-provider).

---

## Step 2. Create the A record at your DNS provider

You need one DNS record:

| Field | Value |
| :--- | :--- |
| **Type** | `A` |
| **Host / Name** | the sub-part of your `DOMAIN` (see below) |
| **Value / Target** | the public IPv4 printed by `setup.sh` |
| **TTL** | as low as your provider allows (e.g. 60 or 300 seconds) |

The `Host` field is the part of `DOMAIN` **before** your registered domain:

- `DOMAIN=juicy.example.com`, registered domain `example.com` → Host = `juicy`
- `DOMAIN=example.com` (the apex) → Host = `@` (or leave blank, depending on the provider)

If your provider also serves a stale `AAAA` (IPv6) record for the same host, delete it or point it at the server's IPv6 (`hcloud server describe multi-juicer` shows it) — otherwise browsers may prefer IPv6 and skip the fresh `A` record, breaking the Let's Encrypt HTTP-01 challenge.

Once DNS has propagated (usually seconds to minutes for a small TTL), the script continues automatically, installs `k3s`, joins worker nodes (if configured), configures Traefik with Let's Encrypt ACME, and deploys MultiJuicer.

---

## Step 3. Wait for the installation to finish

Expect the full run to take about **5–10 minutes**. The script is idempotent: if you re-run it, existing Hetzner resources are reused and the DNS wait loop short-circuits as soon as the record already resolves.

When the script finishes, it prints:

```
URL:              https://juicy.example.com
Admin team:       admin
Admin password:   <generated>
Max teams:        200
Balancer replicas:3
Cluster nodes:    4 (1 control plane, 3 workers)
Kubeconfig:       ./.multi-juicer-hetzner/kubeconfig.yaml
SSH into server:  ssh -i ./.multi-juicer-hetzner/id_ed25519 root@<ip>
```

---

## Step 4. Verify

```bash
# Point kubectl at the fresh cluster:
export KUBECONFIG="$(pwd)/.multi-juicer-hetzner/kubeconfig.yaml"

# Inspect nodes and pods:
kubectl get nodes -o wide
kubectl get pods -A
kubectl get ingress

# Traefik stores the issued cert in acme.json on its persistent volume:
kubectl -n kube-system logs deploy/traefik | grep -i acme

# Admin password:
kubectl get secrets multi-juicer-secret -o jsonpath='{.data.adminPassword}' | base64 -d
```

Then browse to `https://<DOMAIN>/balancer/` and log in as team `admin` with the printed password to access the admin UI.

---

## Step 5. Tear everything down after the event

```bash
./teardown.sh
```

This deletes all Hetzner Cloud worker servers, the control-plane server, the private network, firewall, and SSH key, and wipes the local `.multi-juicer-hetzner/` state directory. From this point on, no Hetzner resources are billed.

The `A` record at your DNS provider is **not** touched by `teardown.sh` — remove it manually at your registrar if you no longer need it.
