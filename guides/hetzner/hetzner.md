# Example Setup with Hetzner Cloud

This guide sets up a MultiJuicer cluster on a single [Hetzner Cloud](https://www.hetzner.com/cloud) server, sized for up to **10 teams**, reachable via public Internet on your own domain over **HTTPS** (Let's Encrypt).

The domain is expected to be registered/managed at **your existing DNS provider** (e.g. [Strato](https://www.strato.de), GoDaddy, Namecheap, Cloudflare, ...). This guide does **not** move your domain to Hetzner — you just point a single `A` record at the freshly-created Hetzner VM.

The setup is intentionally **throw-away**: everything lives on one VM, so once your event is over you delete the server (and the few surrounding resources) and pay nothing more. Two scripts in this folder do the whole thing:

- [`setup.sh`](./setup.sh) — provisions everything from scratch
- [`teardown.sh`](./teardown.sh) — deletes every Hetzner resource created by `setup.sh`

**WARNING:** The default server type used here (`cpx22`, 2 vCPU / 4 GB RAM / 40 GB SSD) costs roughly **€6/month** (~€0.01/h) on Hetzner Cloud. Delete the resources with `teardown.sh` when you no longer need them.

## What the script creates

| Resource                       | Where                | Purpose                                                          |
|--------------------------------|----------------------|------------------------------------------------------------------|
| SSH key (`ed25519`)            | local + Hetzner Cloud | Login key for the fresh VM                                       |
| Firewall (`multi-juicer-fw`)   | Hetzner Cloud        | Allows inbound tcp/22, tcp/80, tcp/443 (world) and tcp/6443 (k8s API, restricted to your public IP) |
| Server (`multi-juicer`, cpx22) | Hetzner Cloud        | Single-node cluster host                                         |
| k3s (Traefik disabled)         | on the VM            | Lightweight Kubernetes                                           |
| ingress-nginx                  | in-cluster           | HTTP(S) entry point (matches chart default `ingressClassName`)   |
| cert-manager + ClusterIssuer   | in-cluster           | Automatic Let's Encrypt certificate                              |
| MultiJuicer Helm release       | in-cluster           | The MultiJuicer balancer (2 replicas by default) + on-demand JuiceShop instances |
| LLM gateway secret (optional)  | in-cluster           | Holds the upstream LLM API key so the JuiceShop chatbot / AI challenges work (only created when `LLM_API_KEY` is set) |

DNS is **not** in the table on purpose: the A record for `DOMAIN` stays at your existing DNS provider and is managed by you (see [Step 2](#step-2-create-the-a-record-at-your-dns-provider)).

## Prerequisites

1. A **domain** you control at any DNS provider — you only need to be able to add a single `A` record to it.
2. A **Hetzner Cloud API token** with read/write access — [create one here](https://console.hetzner.cloud/) under `Security > API Tokens`.
3. The following CLI tools installed and on your `PATH`:
   - [`hcloud`](https://github.com/hetznercloud/cli)
   - [`kubectl`](https://kubernetes.io/docs/tasks/tools/)
   - [`helm`](https://helm.sh)
   - `ssh`, `ssh-keygen`, `curl`, `jq` (present on any Linux/macOS box and via WSL / Git Bash on Windows)

> Windows users: run the scripts from **WSL** or **Git Bash**. Native PowerShell will not execute `bash` scripts.

## Step 1. Configure the environment and start the setup

Set at least the three required variables. Everything else has sensible defaults you can override.

```bash
export HCLOUD_TOKEN="<your hetzner cloud api token>"
export DOMAIN="juicy.example.com"    # any subdomain of a domain you control
export EMAIL="you@example.com"       # used for Let's Encrypt registration

# Optional overrides:
# export SERVER_TYPE=cpx22           # ~10 teams. Use cpx31/cpx41 (or ccx23 for dedicated CPUs) for larger events.
# export SERVER_LOCATION=nbg1        # nbg1 | fsn1 | hel1 | ash | hil | sin
# export MAX_INSTANCES=10            # caps the number of JuiceShop instances
# export REPLICAS=2                  # MultiJuicer balancer replicas (production checklist recommends >=2)
# export DNS_TIMEOUT=1800            # seconds to wait for DNS to propagate
# export ADMIN_CIDR=1.2.3.4/32       # CIDR allowed to reach the k8s API (tcp/6443).
#                                    # Defaults to your current public IPv4 (auto-detected via api.ipify.org).

# Optional: enable the LLM gateway so the JuiceShop chatbot / AI challenges work.
# When unset, the gateway stays off and the chatbot is not available to teams.
# See guides/llm/llm.md for background.
# export LLM_API_KEY="sk-..."                       # your upstream LLM API key
# export LLM_MODEL="qwen/qwen3.5-9b"                # default shown
# export LLM_API_URL="https://openrouter.ai/api/v1" # any OpenAI-compatible base URL

cd guides/hetzner
chmod +x setup.sh teardown.sh
./setup.sh
```

The script first provisions the Hetzner Cloud SSH key, firewall and server, then **pauses** and prints the VM's public IPv4, e.g.:

```
----------------------------------------------------------------------
Create an A record at your DNS provider (e.g. Strato) before continuing:

    Host / Name:  juicy.example.com
    Type:         A
    Value / IPv4: 203.0.113.42
    TTL:          as low as your provider allows (e.g. 300 s / 1 min)

The script will now poll public DNS every 10 s until juicy.example.com
resolves to 203.0.113.42. Press Ctrl+C to abort.
----------------------------------------------------------------------
```

Leave the script running and switch to your DNS provider to create the record — see the next step.

## Step 2. Create the A record at your DNS provider

You need one DNS record:

| Field         | Value                                    |
|---------------|------------------------------------------|
| Type          | `A`                                      |
| Host / Name   | the sub-part of your `DOMAIN` (see below)|
| Value / Target| the public IPv4 printed by `setup.sh`    |
| TTL           | as low as your provider allows (e.g. 60 or 300 seconds — keeps re-runs fast) |

The `Host` field is the part of `DOMAIN` **before** your registered domain:

- `DOMAIN=juicy.example.com`, registered domain `example.com` → Host = `juicy`
- `DOMAIN=example.com` (the apex) → Host = `@` (or leave blank, depending on the provider)

### Strato (strato.de) — click-by-click

Strato splits this into two screens: you first create (or select) the subdomain under the domain, then you edit its DNS **A-Record** and point it at your own IP. If you are pointing the apex domain (`DOMAIN=example.com`) at Hetzner, skip step 2 — the A-Record for the domain itself is edited directly.

Log in at <https://www.strato.de/apps/CustomerService> and open your package, then:

1. **Open Domain management** — go to **Domains → Domainverwaltung**. You will see all domains of your package.
2. **Create the subdomain** (only when `DOMAIN` is a subdomain like `juicy.example.com`):
   - In the row of the parent domain (e.g. `example.com`) click **Webserver** (or **Subdomains anzeigen → Subdomain anlegen** on older UIs).
   - Enter the subdomain label (the `Host` from the table above, e.g. `juicy`) and click **Subdomain anlegen** (Create subdomain).
   - Strato usually points a fresh subdomain at its shared hosting by default; the next step overrides that with your Hetzner IP.
3. **Open the DNS settings** — back in **Domainverwaltung**, click the ⚙ **gear icon** next to the entry you want to change:
   - For a subdomain: the gear icon of the subdomain row you just created.
   - For the apex `DOMAIN=example.com`: the gear icon of the domain itself.
4. **Edit the A-Record** — switch to the **DNS** tab and click **A-Record verwalten** (Manage A-Record).
5. **Point it at Hetzner** — switch the selector from the default (Strato hosting) to **Eigene IP-Adresse** (Own IP address), enter the IPv4 printed by `setup.sh` (e.g. `203.0.113.42`) and confirm with **Einstellungen übernehmen** (Apply settings).

While you are on the same **DNS** tab, also check **AAAA-Record verwalten**: if there is a stale IPv6 record from Strato's shared hosting, either delete it or point it at the server's IPv6 (`hcloud server describe multi-juicer` shows it). A stale `AAAA` can make the browser prefer IPv6 and skip the fresh `A` record, and it also breaks the Let's Encrypt HTTP-01 challenge.

Strato usually publishes the change within a few minutes; the `setup.sh` polling loop will pick it up automatically. Note that Strato only exposes A-, AAAA-, MX-, TXT-, CNAME- and NS-Record editors — there is no generic "add DNS record" dialog with a free-form prefix field, so the subdomain always has to exist as its own entry before you can point it anywhere.

### Other providers

Any DNS provider works the same way — add one `A` record `DOMAIN → <printed IP>`. Some common admin panels:

- **Cloudflare**: `example.com` zone → **DNS** → **Add record** (Type = `A`, Name = subdomain, IPv4 = printed IP; turn **Proxy status** off so Let's Encrypt sees the server directly).
- **Namecheap**: Domain list → **Manage → Advanced DNS → Add new record** (Type = `A Record`, Host = subdomain, Value = printed IP).
- **GoDaddy**: **My Products → DNS → Add** (Type = `A`, Name = subdomain, Value = printed IP).

Once DNS has propagated (usually seconds to minutes for a small TTL), the script continues automatically and installs k3s, ingress-nginx, cert-manager and MultiJuicer.

## Step 3. Wait for the install to finish

Expect the full run to take about **5–8 minutes** — most of the time is spent booting the VM, pulling the k3s + ingress-nginx + cert-manager + JuiceShop images, and issuing the Let's Encrypt certificate. The script is idempotent: if you re-run it, existing Hetzner resources are reused and the DNS wait loop short-circuits as soon as the record already resolves.

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

The `A` record at your DNS provider is **not** touched by `teardown.sh` — remove it manually at Strato / your registrar if you no longer need it (or leave it in place if you plan to spin the cluster up again for the next event; the next `setup.sh` run will just re-use it once you update it to the new VM's IP).

## Production hardening baked into `setup.sh`

The script already applies the recommendations from [`guides/production-notes/production-notes.md`](../production-notes/production-notes.md) so you don't have to think about them:

- **`cookie.secure=true`** — the balancer session cookie is only sent over HTTPS (safe here because everything runs behind Let's Encrypt).
- **Persistent `cookie.cookieParserSecret`** — a 24-char random secret is generated on the first run and stored in `./.multi-juicer-hetzner/cookie-parser-secret`. Re-runs reuse it, so `helm upgrade` no longer invalidates all team sessions. Delete the file if you want to force a rotation.
- **`replicas=2`** — two balancer pods on the single node, so a pod crash or rolling upgrade does not take the whole event offline. Override with `REPLICAS=<n>`. (Note: the node itself is a single VM — for real HA you would need multiple nodes.)
- **`config.maxInstances=10`** — matches the ~10 team sizing of the default `cpx22`. Override with `MAX_INSTANCES` (and pick a bigger `SERVER_TYPE` if you raise it much).

## AI / LLM challenges

Juice Shop's chatbot talks to an OpenAI-compatible LLM. MultiJuicer ships an internal **LLM gateway** so the real API key never lands inside a JuiceShop pod — see [`guides/llm/llm.md`](../llm/llm.md) for the full background.

To enable it in this Hetzner setup, set `LLM_API_KEY` (and optionally `LLM_MODEL` / `LLM_API_URL`) **before** running `setup.sh`:

```bash
export LLM_API_KEY="sk-..."                       # OpenAI / OpenRouter / Ollama key
export LLM_MODEL="qwen/qwen3.5-9b"                # any model your provider serves
export LLM_API_URL="https://openrouter.ai/api/v1" # any OpenAI-compatible base URL
./setup.sh
```

The script then creates a Kubernetes Secret `multi-juicer-llm` in the `default` namespace and passes `config.juiceShop.llm.enabled=true` (plus `model`, `apiUrl`, and `existingSecret`) to Helm. You can rotate the key later by re-exporting `LLM_API_KEY` and re-running `setup.sh` — the secret is upserted via `kubectl apply`.

If `LLM_API_KEY` is **not** set, the script prints a warning and leaves the gateway off. The rest of MultiJuicer still works; only the JuiceShop chatbot / AI challenges are unavailable to teams.

> **Cost tip:** the gateway does not enforce per-team rate limits — set a spending cap at your LLM provider before the event.

## Sizing notes

The defaults target a small event on the cheapest sensible Hetzner box (`cpx22`: 2 vCPU / 4 GB RAM / 40 GB SSD). The math behind `MAX_INSTANCES=10`:

- Per Juice Shop pod (from the upstream project's stated **minimum** system requirements): **256 MB RAM**, **200 millicpu**, **300 MB disk**. Recommended is 384 MB / 400 millicpu / 800 MB disk.
- k3s + ingress-nginx + cert-manager + 2 MultiJuicer balancer replicas reserve roughly **1.1 vCPU** and **1.4 GB RAM** on the node, leaving about **900 mCPU**, **2.6 GB RAM** and ~30 GB free disk for Juice Shop pods.
- CPU is the tightest resource: 900 mCPU / 200 mCPU ≈ 4–5 pods at Juice Shop's stated minimum, or ~6 pods at the chart's default request of 150 mCPU. Since teams are mostly idle and no CPU **limits** are set, a soft cap of 10 is a realistic compromise. RAM (~10 pods at 256 MB) and disk (>90 pods at 300 MB) are not the bottleneck.

Guidelines for scaling up:

- Want more than ~10 teams? Bump both variables together, e.g. `SERVER_TYPE=cpx31` (4 vCPU / 8 GB) with `MAX_INSTANCES=25`, or the previous `SERVER_TYPE=cpx41` (8 vCPU / 16 GB) with `MAX_INSTANCES=50`.
- If you expect heavy concurrent traffic per team (e.g. teams actively hacking rather than reading), switch to a **dedicated-CPU** type (e.g. `ccx23` / `ccx33`) via `SERVER_TYPE` — shared-vCPU plans like `cpx*` can throttle under sustained load.
- To hard-cap the number of teams, use `MAX_INSTANCES`. See the chart's `config.maxInstances` value in [`helm/multi-juicer/values.yaml`](../../helm/multi-juicer/values.yaml) for the full list of tunables.

## Troubleshooting

- **Script keeps polling and never continues** — the `A` record hasn't propagated yet. Double-check at your DNS provider that the record type is `A`, the host matches your `DOMAIN`, and the value matches the IP the script printed. You can also verify from another machine with `dig +short A <DOMAIN> @1.1.1.1` — the script uses the same Cloudflare resolver (`1.1.1.1`) via DNS-over-HTTPS.
- **Wrong IP resolved / stale record** — if you re-created the VM, `DOMAIN` may still resolve to the previous IP because of TTL caching at your provider or resolver. Update the record at your provider, wait for the old TTL to expire, and re-run `setup.sh`.
- **Certificate stuck in `Ready: False`** — check `kubectl describe certificate multi-juicer-tls` and `kubectl -n cert-manager logs deploy/cert-manager`. The most common cause is that DNS hasn't propagated to the Let's Encrypt validators yet; wait a minute and retry. A stale `AAAA` record pointing at a non-existent IPv6 host also breaks the ACME HTTP-01 challenge — delete or update it.
- **Browser shows "Kubernetes Ingress Controller Fake Certificate"** — cert-manager hasn't finished the ACME challenge yet. Reload after ~30–60 s.
- **Pods stuck `Pending`** — the node ran out of schedulable CPU or memory. On the default `cpx22`, CPU is the tightest resource, so this typically happens when `MAX_INSTANCES` is raised without also picking a bigger `SERVER_TYPE`. Choose a bigger `SERVER_TYPE` (e.g. `cpx31` / `cpx41`) and re-run `setup.sh`.
- **`kubectl` / `helm` time out with `dial tcp <ip>:6443: ... failed to respond`** — the Hetzner firewall is not letting your machine reach the Kubernetes API. `setup.sh` opens tcp/6443 only for the public IPv4 it detects via `api.ipify.org` when it runs, so if your public IP has changed since the last run (new network, VPN toggled, ISP-reassigned dynamic address), just re-run `setup.sh` — the firewall rules are re-applied every run and the current IP will be allowed. Behind a shared/corporate egress or on a dynamic range, set `ADMIN_CIDR` explicitly (e.g. `ADMIN_CIDR=203.0.113.0/24 ./setup.sh`).
