#!/usr/bin/env bash
#
# Provision a throw-away MultiJuicer cluster on Hetzner Cloud (~20 teams):
# one VM, k3s + bundled Traefik with ACME (Let's Encrypt), MultiJuicer via Helm.
# The DNS A record for DOMAIN is managed by you; the script waits for it to
# resolve to the new VM before continuing. See hetzner.md for full details.
#
# Required env: HCLOUD_TOKEN, DOMAIN, EMAIL
# Optional env (LLM gateway, see guides/llm/llm.md): LLM_API_KEY, LLM_MODEL, LLM_API_URL
# Required binaries: hcloud, kubectl, helm, ssh, ssh-keygen, curl, jq, openssl

set -euo pipefail

############################
# Configuration (override via env vars)
############################
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN is required (Hetzner Cloud API token)}"
: "${DOMAIN:?DOMAIN is required, e.g. juicy.example.com (managed at your DNS provider)}"
: "${EMAIL:?EMAIL is required (used for Lets Encrypt registration)}"

# See guides/production-notes/production-notes.md.
REPLICAS="${REPLICAS:-2}"                           # >=2 for pod-crash / upgrade resilience

# LLM gateway (guides/llm/llm.md); enabled only when LLM_API_KEY is set.
LLM_API_KEY="${LLM_API_KEY:-}"
LLM_MODEL="${LLM_MODEL:-inclusionai/ling-3.0-flash-fin:free}"
LLM_API_URL="${LLM_API_URL:-https://openrouter.ai/api/v1}"
LLM_SECRET_NAME="${LLM_SECRET_NAME:-multi-juicer-llm}"

SERVER_NAME="${SERVER_NAME:-multi-juicer}"
SERVER_TYPE="${SERVER_TYPE:-cpx32}"                 # use cpx22/cpx32/cpx42 for 5/20/30 teams
SERVER_IMAGE="${SERVER_IMAGE:-ubuntu-24.04}"
SERVER_LOCATION="${SERVER_LOCATION:-nbg1}"          # Nuremberg
SSH_KEY_NAME="${SSH_KEY_NAME:-${SERVER_NAME}-key}"
FIREWALL_NAME="${FIREWALL_NAME:-${SERVER_NAME}-fw}"
K3S_CHANNEL="${K3S_CHANNEL:-stable}"
MAX_INSTANCES="${MAX_INSTANCES:-20}"                # use 5/20/30 with cpx22/cpx32/cpx42 VMs
LE_SERVER="${LE_SERVER:-https://acme-v02.api.letsencrypt.org/directory}"
LE_TIMEOUT="${LE_TIMEOUT:-180}"                    # seconds to wait for a trusted LE certificate
STATE_DIR="${STATE_DIR:-$(pwd)/.multi-juicer-hetzner}"
KUBECONFIG_FILE="${STATE_DIR}/kubeconfig.yaml"
SSH_KEY_FILE="${STATE_DIR}/id_ed25519"
COOKIE_SECRET_FILE="${COOKIE_SECRET_FILE:-${STATE_DIR}/cookie-parser-secret}"

export HCLOUD_TOKEN
export KUBECONFIG="${KUBECONFIG_FILE}"

mkdir -p "${STATE_DIR}"
chmod 700 "${STATE_DIR}"

log()    { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn()   { printf '\n\033[1;33m!!  %s\033[0m\n' "$*" >&2; }
action() { printf '\n\033[1;36m>>  %s\033[0m\n' "$*"; }

############################
# 0. Sanity checks
############################
for bin in hcloud kubectl helm ssh ssh-keygen curl jq openssl; do
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
# 2. Firewall (22, 80/443 world; 6443 k8s API restricted to ADMIN_CIDR)
############################
# ADMIN_CIDR defaults to your current public IP /32. Override for a shared
# egress or company range (e.g. ADMIN_CIDR=1.2.3.0/24).
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

# Merge current ADMIN_CIDR into the existing 6443 allowlist so re-runs from a
# different location keep previous IPs. ADMIN_CIDR_RESET=1 replaces instead.
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
# DoH via 1.1.1.1 to bypass local DNS caches.
dns_lookup_a() {
  curl -sS -H 'accept: application/dns-json' \
    "https://cloudflare-dns.com/dns-query?name=${DOMAIN}&type=A" \
    | jq -r '.Answer // [] | map(select(.type==1)) | .[].data' 2>/dev/null
}

# Report what DNS currently returns, but only when the answer changes, so the
# poll below stays quiet while nothing moves. The first time we see a wrong
# (rather than missing) answer, point at Cloudflare's cache purge tool: a stale
# entry there — e.g. from a wildcard record with a long TTL — keeps 1.1.1.1 on
# the old IP long after the A record itself is correct.
LAST_REPORTED_IPS="__unset__"
PURGE_HINT_SHOWN=0
report_dns() {
  local ips="${1//$'\n'/, }"
  [[ "${ips}" == "${LAST_REPORTED_IPS}" ]] && return 0
  LAST_REPORTED_IPS="${ips}"
  warn "${DOMAIN} resolves to ${ips:-<nothing>}, expected ${SERVER_IP}"
  if [[ -n "${ips}" && "${PURGE_HINT_SHOWN}" == "0" ]]; then
    PURGE_HINT_SHOWN=1
    cat >&2 <<EOF

    If the A record is already in place, the resolver this script queries
    (1.1.1.1) is likely still serving a cached older answer. Purge it at
    https://one.one.one.one/purge-cache/ (name: ${DOMAIN}, type: A) or run:

      curl -sSL -X POST "https://cloudflare-dns.com/api/v1/purge?domain=${DOMAIN}&type=A"

EOF
  fi
}

log "Checking DNS for ${DOMAIN}"
CURRENT_IPS="$(dns_lookup_a || true)"
if echo "${CURRENT_IPS}" | grep -qx "${SERVER_IP}"; then
  log "DNS OK: ${DOMAIN} -> ${SERVER_IP}"
else
  action "Action required: create an A record at your DNS provider"
  cat <<EOF

    Host / Name:  ${DOMAIN}
    Type:         A
    Value / IPv4: ${SERVER_IP}
    TTL:          as low as your provider allows (e.g. 300 s / 1 min)

The script will now poll public DNS every 10 s until ${DOMAIN}
resolves to ${SERVER_IP}. Press Ctrl+C to abort.
EOF

  report_dns "${CURRENT_IPS}"

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
    report_dns "${CURRENT_IPS}"
    printf '.'
    sleep 10
  done
fi

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
  printf '.'
  sleep 5
done

SSH="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${SSH_KEY_FILE} root@${SERVER_IP}"

############################
# 6. Install k3s (with bundled Traefik — we configure it below to also handle Let's Encrypt)
############################
log "Installing k3s on the server"
$SSH "curl -sfL https://get.k3s.io | \
      INSTALL_K3S_CHANNEL=${K3S_CHANNEL} \
      INSTALL_K3S_EXEC='--tls-san=${DOMAIN} --tls-san=${SERVER_IP} --write-kubeconfig-mode=644' \
      sh -" >/dev/null

log "Fetching kubeconfig to ${KUBECONFIG_FILE}"
$SSH 'cat /etc/rancher/k3s/k3s.yaml' \
  | sed "s#https://127.0.0.1:6443#https://${SERVER_IP}:6443#" \
  > "${KUBECONFIG_FILE}"
chmod 600 "${KUBECONFIG_FILE}"

log "Waiting for the node to become Ready"
kubectl wait --for=condition=Ready node --all --timeout=180s

############################
# 7. Configure Traefik with Let's Encrypt (built-in ACME)
############################
# Layer extra values onto k3s's bundled Traefik chart via HelmChartConfig:
# a PVC for acme.json (so certs survive pod restarts) and an HTTP-01
# certResolver 'letsencrypt'. Ingresses opt in via the router.tls.certresolver
# annotation (§10). The chart's default fsGroup=65532 handles PVC ownership.
log "Configuring Traefik with a Let's Encrypt certResolver"
kubectl apply -f - <<EOF
apiVersion: helm.cattle.io/v1
kind: HelmChartConfig
metadata:
  name: traefik
  namespace: kube-system
spec:
  valuesContent: |-
    persistence:
      enabled: true
      name: traefik-data
      accessMode: ReadWriteOnce
      size: 128Mi
      path: /data
    certificatesResolvers:
      letsencrypt:
        acme:
          email: ${EMAIL}
          storage: /data/acme.json
          caServer: ${LE_SERVER}
          httpChallenge:
            entryPoint: web
EOF

# On a fresh k3s the helm-install-traefik Job may not have created the
# Deployment yet, so poll for it before waiting. Also short-circuit on a
# failing helm-install pod so we surface its logs instead of hanging.
log "Waiting for Traefik to reconcile with the new configuration"
TRAEFIK_READY=0
for i in {1..60}; do
  if kubectl -n kube-system get deploy traefik >/dev/null 2>&1; then
    TRAEFIK_READY=1
    break
  fi
  # Fail fast if the helm-install pod is broken.
  FAILING_POD="$(kubectl -n kube-system get pods \
    -l 'helmcharts.helm.cattle.io/chart=traefik' \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.containerStatuses[*].state.waiting.reason}{"\n"}{end}' 2>/dev/null \
    | awk -F'\t' '$2 ~ /CrashLoopBackOff|Error|ImagePullBackOff/ {print $1; exit}')"
  if [[ -n "${FAILING_POD}" ]]; then
    warn "Traefik helm-install Job is failing (pod ${FAILING_POD}). Recent logs:"
    kubectl -n kube-system logs "${FAILING_POD}" --tail=40 >&2 || true
    echo "Fix the HelmChartConfig above, then re-run setup.sh (it is idempotent)." >&2
    exit 1
  fi
  printf '.'
  sleep 5
done
if [[ "${TRAEFIK_READY}" != "1" ]]; then
  echo "Traefik Deployment did not appear within 5 min. Inspect: kubectl -n kube-system get pods,helmchart,helmchartconfig" >&2
  exit 1
fi
kubectl -n kube-system wait --for=condition=Available deploy/traefik --timeout=240s
kubectl -n kube-system rollout status deploy/traefik --timeout=240s

############################
# 8. Cookie parser secret (persisted so helm upgrades don't invalidate sessions)
############################
if [[ ! -s "${COOKIE_SECRET_FILE}" ]]; then
  log "Generating persistent cookieParserSecret at ${COOKIE_SECRET_FILE}"
  # 24 alphanumeric chars (see production-notes.md). Disable pipefail: `head`
  # closes the pipe early, sending SIGPIPE to `tr` which would abort the script.
  set +o pipefail
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 > "${COOKIE_SECRET_FILE}"
  set -o pipefail
  chmod 600 "${COOKIE_SECRET_FILE}"
fi
COOKIE_PARSER_SECRET="$(cat "${COOKIE_SECRET_FILE}")"

############################
# 9. Optional: LLM gateway secret (for AI / chatbot challenges)
############################
HELM_LLM_ARGS=()
if [[ -n "${LLM_API_KEY}" ]]; then
  log "Configuring LLM gateway (model=${LLM_MODEL}, apiUrl=${LLM_API_URL})"
  # Upsert secret so re-runs can rotate the key.
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
# 10. MultiJuicer
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
  --set ingress.ingressClassName=traefik \
  --set-string 'ingress.annotations.traefik\.ingress\.kubernetes\.io/router\.tls=true' \
  --set-string 'ingress.annotations.traefik\.ingress\.kubernetes\.io/router\.tls\.certresolver=letsencrypt' \
  --set-string 'ingress.annotations.traefik\.ingress\.kubernetes\.io/router\.entrypoints=websecure' \
  --set "ingress.hosts[0].host=${DOMAIN}" \
  --set "ingress.hosts[0].paths[0]=/" \
  --set "ingress.tls[0].secretName=multi-juicer-tls" \
  --set "ingress.tls[0].hosts[0]=${DOMAIN}" \
  ${HELM_LLM_ARGS[@]+"${HELM_LLM_ARGS[@]}"}

kubectl -n default rollout status deploy/multi-juicer --timeout=180s

############################
# 11. Request and verify the Let's Encrypt certificate
############################
# Traefik obtains certificates on the first matching HTTPS request. Connect to
# the VM directly while retaining DOMAIN as the TLS SNI name, so this check
# cannot be affected by a stale local DNS cache or proxy configuration.
log "Requesting a Let's Encrypt certificate for ${DOMAIN}"
curl --insecure --silent --show-error --noproxy "${DOMAIN}" \
  --resolve "${DOMAIN}:443:${SERVER_IP}" \
  --connect-timeout 10 --max-time 20 \
  -o /dev/null "https://${DOMAIN}/" >/dev/null 2>&1 || true

LE_CERTIFICATE_ISSUED=0
LE_CERTIFICATE_DETAILS=""
LE_WAITED=0
while (( LE_WAITED <= LE_TIMEOUT )); do
  LE_CERTIFICATE_DETAILS="$(
    printf '' | openssl s_client -connect "${SERVER_IP}:443" -servername "${DOMAIN}" -showcerts 2>/dev/null \
      | openssl x509 -noout -issuer -subject -ext subjectAltName 2>/dev/null || true
  )"

  # curl verifies both the certificate chain and DOMAIN's hostname. Checking
  # the issuer separately ensures the trusted certificate came from LE.
  if curl --silent --show-error --noproxy "${DOMAIN}" \
      --resolve "${DOMAIN}:443:${SERVER_IP}" \
      --connect-timeout 10 --max-time 20 \
      -o /dev/null "https://${DOMAIN}/" >/dev/null 2>&1 \
    && grep -qi "Let's Encrypt" <<<"${LE_CERTIFICATE_DETAILS}"; then
    LE_CERTIFICATE_ISSUED=1
    break
  fi

  if (( LE_WAITED >= LE_TIMEOUT )); then
    break
  fi
  sleep 5
  ((LE_WAITED += 5))
done

if [[ "${LE_CERTIFICATE_ISSUED}" == "1" ]]; then
  log "Let's Encrypt certificate verified for ${DOMAIN}"
  printf '%s\n' "${LE_CERTIFICATE_DETAILS}"
else
  warn "No valid Let's Encrypt certificate was served for ${DOMAIN} after ${LE_TIMEOUT}s."
  warn "Traefik may still be serving its default certificate; recent ACME errors and challenge failures follow:"
  kubectl -n kube-system logs deploy/traefik --since="${LE_TIMEOUT}s" 2>&1 \
    | grep -Ei 'acme|let.?s encrypt|certificate|challenge|error' \
    | sed 's/^/!! /' >&2 || true
  if [[ -n "${LE_CERTIFICATE_DETAILS}" ]]; then
    warn "Certificate currently served by Traefik:"
    printf '%s\n' "${LE_CERTIFICATE_DETAILS}" >&2
  fi
fi

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

The setup script requested and verified the certificate above. If it printed a
warning instead, inspect the Traefik ACME logs it included, fix the reported
DNS or HTTP-01 reachability issue, and re-run setup.sh.
EOF

action "After the event: run ./teardown.sh to delete every Hetzner resource (server, firewall, SSH key) created by this script"
cat <<EOF

  The A record for ${DOMAIN} at your DNS provider is *not* touched — remove it there
  manually if you no longer need it.
EOF
