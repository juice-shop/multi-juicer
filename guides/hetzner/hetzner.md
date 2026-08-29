# Example Setup with Hetzner Cloud

This guide sets up a MultiJuicer cluster on a single [Hetzner Cloud](https://www.hetzner.com/cloud) server, sized for up to **20 teams**, reachable over **HTTPS** on your own domain (Let's Encrypt). The domain stays at your existing DNS provider — you just point an `A` record at the freshly-created VM.

The setup is intentionally throw-away: everything lives on one VM, so after the event you delete it and pay nothing more. Two scripts do the whole thing:

- [`setup.sh`](./setup.sh) — provisions everything from scratch
- [`teardown.sh`](./teardown.sh) — deletes every Hetzner resource created by `setup.sh`

> Expected costs: The default server type (`cpx32`, 4 vCPU / 8 GB RAM / 80 GB SSD) costs ~€0.07/h on Hetzner Cloud capped at ~€42/month. Run `teardown.sh` when you no longer need it.

## What the script creates

| Resource                       | Where                | Purpose                                                          |
|--------------------------------|----------------------|------------------------------------------------------------------|
| SSH key (`ed25519`)            | local + Hetzner Cloud | Login key for the fresh VM                                       |
| Firewall (`multi-juicer-fw`)   | Hetzner Cloud        | Allows inbound tcp/22, tcp/80, tcp/443 (world) and tcp/6443 (k8s API, restricted to your public IP) |
| Server (`multi-juicer`, cpx32) | Hetzner Cloud        | Single-node cluster host                                         |
| k3s (Traefik disabled)         | on the VM            | Lightweight Kubernetes                                           |
| ingress-nginx                  | in-cluster           | HTTP(S) entry point                                              |
| cert-manager + ClusterIssuer   | in-cluster           | Automatic Let's Encrypt certificate                              |
| MultiJuicer Helm release       | in-cluster           | The MultiJuicer balancer (2 replicas by default) + on-demand JuiceShop instances |
| LLM gateway secret (optional)  | in-cluster           | Holds the upstream LLM API key for the JuiceShop chatbot / AI challenges (only created when `LLM_API_KEY` is set) |

The `A` record for `DOMAIN` stays at your existing DNS provider and is managed by you. `setup.sh` already applies the recommendations from [`guides/production-notes/production-notes.md`](../production-notes/production-notes.md) (secure cookie, persistent `cookieParserSecret` stored in `./.multi-juicer-hetzner/cookie-parser-secret`, 2 balancer replicas, `config.maxInstances`).

## Prerequisites

1. A domain you control at any DNS provider — you only need to add a single `A` record to it.
2. A Hetzner Cloud API token with read/write access — [create one here](https://console.hetzner.cloud/) under `Security > API Tokens`.
3. CLI tools on your `PATH`: [`hcloud`](https://github.com/hetznercloud/cli), [`kubectl`](https://kubernetes.io/docs/tasks/tools/), [`helm`](https://helm.sh), plus `ssh`, `ssh-keygen`, `curl`, `jq`.

> Windows users: run the scripts from **WSL** or **Git Bash**. Native PowerShell will not execute `bash` scripts.

## Step 1. Configure the environment and start the setup

Set the three required variables. Everything else has sensible defaults you can override.

```bash
export HCLOUD_TOKEN="<your hetzner cloud api token>"
export DOMAIN="juicy.example.com"    # any subdomain of a domain you control
export EMAIL="you@example.com"       # used for Let's Encrypt registration

# Optional overrides:
# export SERVER_TYPE=cpx32           # ~20 teams. Drop to cpx22 for tiny events, or bump to cpx42 / cpx52 (or ccx23 for dedicated CPUs) for larger ones.
# export SERVER_LOCATION=nbg1        # nbg1 | fsn1 | hel1 | ash | hil | sin
# export MAX_INSTANCES=20            # caps the number of JuiceShop instances (raise together with SERVER_TYPE)
# export REPLICAS=2                  # MultiJuicer balancer replicas
# export DNS_TIMEOUT=1800            # seconds to wait for DNS to propagate
# export ADMIN_CIDR=1.2.3.4/32       # CIDR allowed to reach the k8s API (tcp/6443); defaults to your current public IPv4.
# export ADMIN_CIDR_RESET=1          # On re-run, drop previously-allowed admin IPs instead of appending the new one.
#                                    # Handy when travelling: re-running setup.sh from a hotel/venue *adds* your new
#                                    # public IP to the tcp/6443 allowlist and keeps existing ones (server untouched).

# Optional: enable the LLM gateway so the JuiceShop chatbot / AI challenges work.
# See guides/llm/llm.md for background. The gateway keeps the API key inside the cluster;
# note there is no per-team rate limit, so set a spending cap at your provider before the event.
# export LLM_API_KEY="sk-..."                            # your upstream LLM API key
# export LLM_MODEL="inclusionai/ling-3.0-flash-fin:free" # any model your provider serves
# export LLM_API_URL="https://openrouter.ai/api/v1"     # any OpenAI-compatible base URL

cd guides/hetzner
chmod +x setup.sh teardown.sh
./setup.sh
```

The script first provisions the SSH key, firewall and server, then **pauses** and prints the VM's public IPv4, e.g.:

```
Create an A record at your DNS provider before continuing:

    Host / Name:  juicy.example.com
    Type:         A
    Value / IPv4: 203.0.113.42
    TTL:          as low as your provider allows (e.g. 300 s / 1 min)
```

Leave the script running while continuing with [Step 2](#step-2-create-the-a-record-at-your-dns-provider).

## Step 2. Create the A record at your DNS provider

You need one DNS record:

| Field         | Value                                    |
|---------------|------------------------------------------|
| Type          | `A`                                      |
| Host / Name   | the sub-part of your `DOMAIN` (see below)|
| Value / Target| the public IPv4 printed by `setup.sh`    |
| TTL           | as low as your provider allows (e.g. 60 or 300 seconds) |

The `Host` field is the part of `DOMAIN` **before** your registered domain:

- `DOMAIN=juicy.example.com`, registered domain `example.com` → Host = `juicy`
- `DOMAIN=example.com` (the apex) → Host = `@` (or leave blank, depending on the provider)

If your provider also serves a stale `AAAA` (IPv6) record for the same host, delete it or point it at the server's IPv6 (`hcloud server describe multi-juicer` shows it) — otherwise browsers may prefer IPv6 and skip the fresh `A` record, and the Let's Encrypt HTTP-01 challenge breaks.

Once DNS has propagated (usually seconds to minutes for a small TTL), the script continues automatically and installs k3s, ingress-nginx, cert-manager and MultiJuicer.

## Step 3. Wait for the installation to finish

Expect the full run to take about **5–8 minutes**. The script is idempotent: if you re-run it, existing Hetzner resources are reused and the DNS wait loop short-circuits as soon as the record already resolves.

When it finishes, it prints:

```
URL:              https://juicy.example.com
Admin team:       admin
Admin password:   <generated>
Kubeconfig:       ./.multi-juicer-hetzner/kubeconfig.yaml
SSH into server:  ssh -i ./.multi-juicer-hetzner/id_ed25519 root@<ip>
```

Open `https://<DOMAIN>` in your browser. The first hit may briefly show the ingress' default self-signed certificate while cert-manager completes the HTTP-01 challenge — reload after a few seconds.

## Step 4. Verify

```bash
# Point kubectl at the fresh cluster:
export KUBECONFIG="$(pwd)/.multi-juicer-hetzner/kubeconfig.yaml"

kubectl get pods -A
kubectl get ingress
kubectl get certificate    # should show READY=True within ~1 minute

# Admin password:
kubectl get secrets multi-juicer-secret -o jsonpath='{.data.adminPassword}' | base64 -d
```

Then browse to `https://<DOMAIN>/balancer/` and log in as team `admin` with the printed password to access the admin UI.

## Step 5. Tear everything down after the event

```bash
./teardown.sh
```

This deletes the Hetzner Cloud server, firewall and SSH key, and wipes the local `.multi-juicer-hetzner/` state directory. From this point on, no Hetzner resources are being billed.

The `A` record at your DNS provider is **not** touched by `teardown.sh` — remove it manually at your registrar if you no longer need it.
