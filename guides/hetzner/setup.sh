#!/usr/bin/env bash
#
# Provision a fresh MultiJuicer cluster on Hetzner Cloud, sized for ~20 teams.
#
# The script creates a single Hetzner Cloud VM, installs k3s on it, deploys
# ingress-nginx + cert-manager, installs MultiJuicer via Helm, and requests
# a Let's Encrypt certificate so the balancer UI is reachable over HTTPS on
# your own domain.
#
# The domain is expected to be managed at *your* DNS provider (e.g. Strato,
# GoDaddy, Namecheap, Cloudflare, ...). This script does NOT touch your DNS
# zone. After creating the VM, it prints the VM's public IPv4 and then
# waits until your domain's A record resolves to that IP before continuing
# with the k3s / ingress / Let's Encrypt part.
#
# The setup is intentionally "throw-away": run this before your event,
# run `teardown.sh` afterwards, and every Hetzner resource created here
# is gone.
#
# Prerequisites (see hetzner.md):
#   - hcloud  (https://github.com/hetznercloud/cli)
#   - kubectl (https://kubernetes.io/docs/tasks/tools/)
#   - helm    (https://helm.sh)
#   - ssh, ssh-keygen, curl, jq
#   - A Hetzner Cloud API token   -> env HCLOUD_TOKEN
#   - A domain you control        -> env DOMAIN   (e.g. juicy.example.com)
#     (the A record for it will be   env EMAIL    (used for Let's Encrypt)
#      created manually at your
#      registrar, e.g. Strato)
#
# Optional (for AI / LLM challenges — see guides/llm/llm.md):
#   - env LLM_API_KEY   API key of an OpenAI-compatible LLM provider.
#                       When set, MultiJuicer's built-in LLM gateway is enabled
#                       so the JuiceShop chatbot works for all teams while the
#                       real API key stays inside the cluster.
#   - env LLM_MODEL     Model identifier to expose to JuiceShop
#                       (default: inclusionai/ling-3.0-flash-fin:free).
#   - env LLM_API_URL   Upstream base URL, including path prefix
#                       (default: https://openrouter.ai/api/v1).

set -euo pipefail

############################
# Configuration (override via env vars)
############################
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN is required (Hetzner Cloud API token)}"
: "${DOMAIN:?DOMAIN is required, e.g. juicy.example.com (managed at your DNS provider)}"
: "${EMAIL:?EMAIL is required (used for Lets Encrypt registration)}"

# Production-hardening defaults (see guides/production-notes/production-notes.md).
REPLICAS="${REPLICAS:-2}"                           # >=2 balancer replicas for pod-crash / upgrade resilience

# Optional LLM gateway (see guides/llm/llm.md). Only enabled when LLM_API_KEY is set.
LLM_API_KEY="${LLM_API_KEY:-}"
LLM_MODEL="${LLM_MODEL:-inclusionai/ling-3.0-flash-fin:free}"
LLM_API_URL="${LLM_API_URL:-https://openrouter.ai/api/v1}"
LLM_SECRET_NAME="${LLM_SECRET_NAME:-multi-juicer-llm}"

# Server / cluster sizing. cpx32 = 4 vCPU / 8 GB RAM / 80 GB SSD (Hetzner's newer AMD generation).
# Drop to cpx22 for tiny events, or bump to cpx42 / cpx52 (and raise MAX_INSTANCES accordingly) for larger ones.
SERVER_NAME="${SERVER_NAME:-multi-juicer}"
SERVER_TYPE="${SERVER_TYPE:-cpx32}"
SERVER_IMAGE="${SERVER_IMAGE:-ubuntu-24.04}"
SERVER_LOCATION="${SERVER_LOCATION:-nbg1}"          # Nuremberg
SSH_KEY_NAME="${SSH_KEY_NAME:-${SERVER_NAME}-key}"
FIREWALL_NAME="${FIREWALL_NAME:-${SERVER_NAME}-fw}"
K3S_CHANNEL="${K3S_CHANNEL:-stable}"
MAX_INSTANCES="${MAX_INSTANCES:-20}"                # allowed team count (fits a cpx32; raise together with SERVER_TYPE)
LE_SERVER="${LE_SERVER:-https://acme-v02.api.letsencrypt.org/directory}"
STATE_DIR="${STATE_DIR:-$(pwd)/.multi-juicer-hetzner}"
KUBECONFIG_FILE="${STATE_DIR}/kubeconfig.yaml"
SSH_KEY_FILE="${STATE_DIR}/id_ed25519"
COOKIE_SECRET_FILE="${COOKIE_SECRET_FILE:-${STATE_DIR}/cookie-parser-secret}"

export HCLOUD_TOKEN
export KUBECONFIG="${KUBECONFIG_FILE}"

mkdir -p "${STATE_DIR}"
chmod 700 "${STATE_DIR}"

log()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\n\033[1;33m!!  %s\033[0m\n' "$*" >&2; }

############################
# 0. Sanity checks
############################
for bin in hcloud kubectl helm ssh ssh-keygen curl jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Missing required binary: $bin" >&2; exit 1; }
done

############################
# 1. SSH key
############################
if [[ ! -f "${SSH_KEY_FILE}" ]]; then
  log "Generating ephemeral SSH key at ${SSH_KEY_FILE}"
  ssh-keygen -t ed25519 -N '' -C "${SERVER_NAME}" -f "${SSH_KEY_FILE}" >/dev/null
fi

if ! hcloud ssh-key describe "${SSH_KEY_NAME}" >/dev/null 2>&1; then
  log "Uploading SSH key '${SSH_KEY_NAME}' to Hetzner Cloud"
  hcloud ssh-key create --name "${SSH_KEY_NAME}" --public-key-from-file "${SSH_KEY_FILE}.pub" >/dev/null
fi

############################
# 2. Firewall (22 SSH, 80/443 HTTP(S), 6443 k8s API restricted to your IP)
############################
# The k3s API server listens on tcp/6443. kubectl / helm on your machine
# need to reach it, so we open that port on the Hetzner firewall — but only
# for *your* current public IP (a /32) so the API is not world-exposed.
# Override ADMIN_CIDR (e.g. `1.2.3.0/24`) if you are behind a shared/dynamic
# egress or want to allow a company range.
ADMIN_CIDR="${ADMIN_CIDR:-}"
if [[ -z "${ADMIN_CIDR}" ]]; then
  MY_IP="$(curl -sS https://api.ipify.org 2>/dev/null || true)"
  if [[ -z "${MY_IP}" ]]; then
    echo "Could not auto-detect your public IPv4 (api.ipify.org unreachable). Set ADMIN_CIDR=<ip>/32 explicitly." >&2
    exit 1
  fi
  ADMIN_CIDR="${MY_IP}/32"
fi

if ! hcloud firewall describe "${FIREWALL_NAME}" >/dev/null 2>&1; then
  log "Creating firewall '${FIREWALL_NAME}'"
  hcloud firewall create --name "${FIREWALL_NAME}" >/dev/null
fi

# Merge the (possibly new) ADMIN_CIDR into the firewall's existing 6443 allowlist
# instead of replacing it. This lets you re-run setup.sh from a new location
# (different public IP — e.g. home vs. hotel/venue) and *add* your current IP
# while keeping the previously-allowed ones. Set ADMIN_CIDR_RESET=1 to instead
# drop all previous entries and keep only the current ADMIN_CIDR.
ADMIN_CIDR_RESET="${ADMIN_CIDR_RESET:-0}"
EXISTING_ADMIN_CIDRS=""
if [[ "${ADMIN_CIDR_RESET}" != "1" ]]; then
  EXISTING_ADMIN_CIDRS="$(hcloud firewall describe "${FIREWALL_NAME}" -o json 2>/dev/null \
    | jq -r '(.rules // []) | map(select(.direction=="in" and .protocol=="tcp" and .port=="6443")) | .[].source_ips[]?' \
    || true)"
fi
ADMIN_CIDRS_JSON="$(printf '%s\n%s\n' "${EXISTING_ADMIN_CIDRS}" "${ADMIN_CIDR}" \
  | awk 'NF && !seen[$0]++' \
  | jq -R . | jq -s .)"

log "Allowing Kubernetes API (tcp/6443) from: $(echo "${ADMIN_CIDRS_JSON}" | jq -r 'join(", ")')"

RULES_FILE="${STATE_DIR}/firewall-rules.json"
cat > "${RULES_FILE}" <<EOF
[
  {"direction":"in","protocol":"tcp","port":"22",  "source_ips":["0.0.0.0/0","::/0"]},
  {"direction":"in","protocol":"tcp","port":"80",  "source_ips":["0.0.0.0/0","::/0"]},
  {"direction":"in","protocol":"tcp","port":"443", "source_ips":["0.0.0.0/0","::/0"]},
  {"direction":"in","protocol":"tcp","port":"6443","source_ips":${ADMIN_CIDRS_JSON}}
]
EOF

log "Applying firewall rules to '${FIREWALL_NAME}'"
hcloud firewall replace-rules "${FIREWALL_NAME}" --rules-file "${RULES_FILE}" >/dev/null

############################
# 3. Server
############################
if ! hcloud server describe "${SERVER_NAME}" >/dev/null 2>&1; then
  log "Creating server '${SERVER_NAME}' (${SERVER_TYPE}, ${SERVER_LOCATION}, ${SERVER_IMAGE})"
  hcloud server create \
    --name       "${SERVER_NAME}" \
    --type       "${SERVER_TYPE}" \
    --image      "${SERVER_IMAGE}" \
    --location   "${SERVER_LOCATION}" \
    --ssh-key    "${SSH_KEY_NAME}" \
    --firewall   "${FIREWALL_NAME}" \
    --start-after-create >/dev/null
else
  log "Server '${SERVER_NAME}' already exists, reusing it"
fi

SERVER_IP="$(hcloud server ip "${SERVER_NAME}")"
log "Server public IPv4: ${SERVER_IP}"

############################
# 4. Wait until the user's DNS A record points to this VM
############################
# Uses Cloudflare's DNS-over-HTTPS (1.1.1.1) resolver so we bypass any local
# DNS caches. curl + jq are already required by the script.
dns_lookup_a() {
  curl -sS -H 'accept: application/dns-json' \
    "https://cloudflare-dns.com/dns-query?name=${DOMAIN}&type=A" \
    | jq -r '.Answer // [] | map(select(.type==1)) | .[].data' 2>/dev/null
}

cat <<EOF

----------------------------------------------------------------------
Create an A record at your DNS provider before continuing:

    Host / Name:  ${DOMAIN}
    Type:         A
    Value / IPv4: ${SERVER_IP}
    TTL:          as low as your provider allows (e.g. 300 s / 1 min)

The script will now poll public DNS every 10 s until ${DOMAIN}
resolves to ${SERVER_IP}. Press Ctrl+C to abort.
----------------------------------------------------------------------
EOF

DNS_TIMEOUT="${DNS_TIMEOUT:-1800}"   # 30 minutes
SECONDS=0
while :; do
  CURRENT_IPS="$(dns_lookup_a || true)"
  if echo "${CURRENT_IPS}" | grep -qx "${SERVER_IP}"; then
    log "DNS OK: ${DOMAIN} -> ${SERVER_IP}"
    break
  fi
  if (( SECONDS >= DNS_TIMEOUT )); then
    echo "DNS did not propagate within ${DNS_TIMEOUT}s. ${DOMAIN} currently resolves to: ${CURRENT_IPS:-<nothing>}" >&2
    echo "Re-run this script once the A record is in place — it is idempotent." >&2
    exit 1
  fi
  printf '.'
  sleep 10
done

############################
# 5. Wait for SSH to be ready
############################
log "Waiting for SSH on ${SERVER_IP}"
for i in {1..60}; do
  if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
         -o ConnectTimeout=5 -i "${SSH_KEY_FILE}" \
         "root@${SERVER_IP}" 'true' 2>/dev/null; then
    break
  fi
  sleep 5
done

SSH="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${SSH_KEY_FILE} root@${SERVER_IP}"

############################
# 6. Install k3s (Traefik disabled — we use ingress-nginx to match the chart's default ingressClassName)
############################
log "Installing k3s on the server"
$SSH "curl -sfL https://get.k3s.io | \
      INSTALL_K3S_CHANNEL=${K3S_CHANNEL} \
      INSTALL_K3S_EXEC='--disable=traefik --tls-san=${DOMAIN} --tls-san=${SERVER_IP} --write-kubeconfig-mode=644' \
      sh -" >/dev/null

log "Fetching kubeconfig to ${KUBECONFIG_FILE}"
$SSH 'cat /etc/rancher/k3s/k3s.yaml' \
  | sed "s#https://127.0.0.1:6443#https://${SERVER_IP}:6443#" \
  > "${KUBECONFIG_FILE}"
chmod 600 "${KUBECONFIG_FILE}"

log "Waiting for the node to become Ready"
kubectl wait --for=condition=Ready node --all --timeout=180s

############################
# 7. ingress-nginx
############################
log "Installing ingress-nginx"
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace \
  --set controller.service.type=NodePort \
  --set controller.hostPort.enabled=true \
  --set controller.hostPort.ports.http=80 \
  --set controller.hostPort.ports.https=443 \
  --set controller.kind=DaemonSet \
  --set controller.publishService.enabled=false

kubectl -n ingress-nginx rollout status ds/ingress-nginx-controller --timeout=180s

############################
# 8. cert-manager + Let's Encrypt ClusterIssuer
############################
log "Installing cert-manager"
helm repo add jetstack https://charts.jetstack.io >/dev/null 2>&1 || true
helm repo update >/dev/null
helm upgrade --install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set crds.enabled=true

kubectl -n cert-manager rollout status deploy/cert-manager --timeout=180s
kubectl -n cert-manager rollout status deploy/cert-manager-webhook --timeout=180s

log "Creating Let's Encrypt ClusterIssuer"
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt
spec:
  acme:
    server: ${LE_SERVER}
    email: ${EMAIL}
    privateKeySecretRef:
      name: letsencrypt-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
EOF

############################
# 9. Cookie parser secret (persistent across re-runs — otherwise every
#    `helm upgrade` rotates it and invalidates all team sessions)
############################
if [[ ! -s "${COOKIE_SECRET_FILE}" ]]; then
  log "Generating persistent cookieParserSecret at ${COOKIE_SECRET_FILE}"
  # 24 alphanumeric chars, matches the recommendation in production-notes.md.
  # `head -c 24` closes the pipe early, which sends SIGPIPE to `tr` (exit 141);
  # under `set -o pipefail` that fails the whole pipeline and aborts the script,
  # so temporarily disable pipefail just for this one pipeline.
  set +o pipefail
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 > "${COOKIE_SECRET_FILE}"
  set -o pipefail
  chmod 600 "${COOKIE_SECRET_FILE}"
fi
COOKIE_PARSER_SECRET="$(cat "${COOKIE_SECRET_FILE}")"

############################
# 10. Optional: LLM gateway secret (for AI / chatbot challenges)
############################
HELM_LLM_ARGS=()
if [[ -n "${LLM_API_KEY}" ]]; then
  log "Configuring LLM gateway (model=${LLM_MODEL}, apiUrl=${LLM_API_URL})"
  # Upsert the k8s secret with the upstream API key. `kubectl apply` avoids
  # errors on re-runs and lets the user rotate the key by re-running setup.sh.
  kubectl create secret generic "${LLM_SECRET_NAME}" \
    --namespace default \
    --from-literal=token="${LLM_API_KEY}" \
    --dry-run=client -o yaml | kubectl apply -f - >/dev/null
  HELM_LLM_ARGS+=(
    --set config.juiceShop.llm.enabled=true
    --set-string "config.juiceShop.llm.model=${LLM_MODEL}"
    --set-string "config.juiceShop.llm.apiUrl=${LLM_API_URL}"
    --set-string "config.juiceShop.llm.existingSecret.name=${LLM_SECRET_NAME}"
    --set-string config.juiceShop.llm.existingSecret.key=token
  )
else
  warn "LLM_API_KEY not set — LLM gateway disabled. The JuiceShop chatbot / AI challenges will not work."
  warn "To enable them, set LLM_API_KEY (and optionally LLM_MODEL / LLM_API_URL) and re-run setup.sh."
fi

############################
# 11. MultiJuicer
############################
log "Installing MultiJuicer via Helm (replicas=${REPLICAS}, maxInstances=${MAX_INSTANCES})"
helm upgrade --install multi-juicer \
  oci://ghcr.io/juice-shop/multi-juicer/helm/multi-juicer \
  --namespace default \
  --set "replicas=${REPLICAS}" \
  --set cookie.secure=true \
  --set-string "cookie.cookieParserSecret=${COOKIE_PARSER_SECRET}" \
  --set "config.maxInstances=${MAX_INSTANCES}" \
  --set ingress.enabled=true \
  --set ingress.ingressClassName=nginx \
  --set-string 'ingress.annotations.cert-manager\.io/cluster-issuer=letsencrypt' \
  --set "ingress.hosts[0].host=${DOMAIN}" \
  --set "ingress.hosts[0].paths[0]=/" \
  --set "ingress.tls[0].secretName=multi-juicer-tls" \
  --set "ingress.tls[0].hosts[0]=${DOMAIN}" \
  ${HELM_LLM_ARGS[@]+"${HELM_LLM_ARGS[@]}"}

kubectl -n default rollout status deploy/multi-juicer --timeout=180s

############################
# 12. Done
############################
ADMIN_PW="$(kubectl get secret multi-juicer-secret -o jsonpath='{.data.adminPassword}' | base64 -d)"

LLM_STATUS="disabled (JuiceShop chatbot / AI challenges will not work)"
if [[ -n "${LLM_API_KEY}" ]]; then
  LLM_STATUS="enabled — model=${LLM_MODEL}, upstream=${LLM_API_URL}"
fi

cat <<EOF

$(log "MultiJuicer is ready")

  URL:              https://${DOMAIN}
  Admin team:       admin
  Admin password:   ${ADMIN_PW}
  Max teams:        ${MAX_INSTANCES}
  Balancer replicas:${REPLICAS}
  LLM gateway:      ${LLM_STATUS}

  Kubeconfig:       ${KUBECONFIG_FILE}
  SSH into server:  ssh -i ${SSH_KEY_FILE} root@${SERVER_IP}
  Cookie secret:    ${COOKIE_SECRET_FILE} (keep it — re-runs reuse it so team sessions survive helm upgrades)

The Let's Encrypt certificate is issued on the first HTTPS request and can
take up to a minute. If the browser initially shows the ingress default
certificate, wait a moment and reload.

When your event is over, run ./teardown.sh to delete every Hetzner
resource (server, firewall, SSH key) created by this script. The A
record for ${DOMAIN} at your DNS provider is *not* touched — remove
it there manually if you no longer need it.
EOF
