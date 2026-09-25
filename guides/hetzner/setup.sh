#!/usr/bin/env bash
#
# Provisions a MultiJuicer cluster on Hetzner Cloud (single-VM or multi-VM).
# See hetzner.md for documentation and configuration options.

set -euo pipefail

############################
# Configuration (override via env vars)
############################
: "${HCLOUD_TOKEN:?HCLOUD_TOKEN is required (Hetzner Cloud API token)}"
: "${DOMAIN:?DOMAIN is required, e.g. juicy.example.com (managed at your DNS provider)}"
: "${EMAIL:?EMAIL is required (used for Lets Encrypt registration)}"

HCLOUD_TOKEN="${HCLOUD_TOKEN//$'\r'/}"
DOMAIN="${DOMAIN//$'\r'/}"
EMAIL="${EMAIL//$'\r'/}"

REPLICAS="${REPLICAS:-2}"; REPLICAS="${REPLICAS//$'\r'/}"

LLM_API_KEY="${LLM_API_KEY:-}"; LLM_API_KEY="${LLM_API_KEY//$'\r'/}"
LLM_MODEL="${LLM_MODEL:-inclusionai/ling-3.0-flash-fin:free}"; LLM_MODEL="${LLM_MODEL//$'\r'/}"
LLM_API_URL="${LLM_API_URL:-https://openrouter.ai/api/v1}"; LLM_API_URL="${LLM_API_URL//$'\r'/}"
LLM_SECRET_NAME="${LLM_SECRET_NAME:-multi-juicer-llm}"; LLM_SECRET_NAME="${LLM_SECRET_NAME//$'\r'/}"

SERVER_NAME="${SERVER_NAME:-multi-juicer}"; SERVER_NAME="${SERVER_NAME//$'\r'/}"
SERVER_TYPE="${SERVER_TYPE:-cpx32}"; SERVER_TYPE="${SERVER_TYPE//$'\r'/}"
SERVER_IMAGE="${SERVER_IMAGE:-ubuntu-24.04}"; SERVER_IMAGE="${SERVER_IMAGE//$'\r'/}"
SERVER_LOCATION="${SERVER_LOCATION:-nbg1}"; SERVER_LOCATION="${SERVER_LOCATION//$'\r'/}"
SSH_KEY_NAME="${SSH_KEY_NAME:-${SERVER_NAME}-key}"; SSH_KEY_NAME="${SSH_KEY_NAME//$'\r'/}"
FIREWALL_NAME="${FIREWALL_NAME:-${SERVER_NAME}-fw}"; FIREWALL_NAME="${FIREWALL_NAME//$'\r'/}"
K3S_CHANNEL="${K3S_CHANNEL:-stable}"; K3S_CHANNEL="${K3S_CHANNEL//$'\r'/}"
MAX_INSTANCES="${MAX_INSTANCES:-20}"; MAX_INSTANCES="${MAX_INSTANCES//$'\r'/}"

WORKER_COUNT="${WORKER_COUNT:-0}"; WORKER_COUNT="${WORKER_COUNT//$'\r'/}"
WORKER_TYPE="${WORKER_TYPE:-${SERVER_TYPE}}"; WORKER_TYPE="${WORKER_TYPE//$'\r'/}"
NETWORK_NAME="${NETWORK_NAME:-${SERVER_NAME}-net}"; NETWORK_NAME="${NETWORK_NAME//$'\r'/}"
NETWORK_RANGE="${NETWORK_RANGE:-10.0.0.0/16}"; NETWORK_RANGE="${NETWORK_RANGE//$'\r'/}"
NETWORK_ZONE="${NETWORK_ZONE:-eu-central}"; NETWORK_ZONE="${NETWORK_ZONE//$'\r'/}"

LE_SERVER="${LE_SERVER:-https://acme-v02.api.letsencrypt.org/directory}"; LE_SERVER="${LE_SERVER//$'\r'/}"
LE_TIMEOUT="${LE_TIMEOUT:-180}"; LE_TIMEOUT="${LE_TIMEOUT//$'\r'/}"
STATE_DIR="${STATE_DIR:-$(pwd)/.multi-juicer-hetzner}"; STATE_DIR="${STATE_DIR//$'\r'/}"
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
# 2. Firewall
############################
ADMIN_CIDR="${ADMIN_CIDR:-}"
ADMIN_CIDR="${ADMIN_CIDR//$'\r'/}"
if [[ -z "${ADMIN_CIDR}" ]]; then
  MY_IP="$(curl -sS https://api.ipify.org 2>/dev/null | tr -d '\r' || true)"
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

ADMIN_CIDR_RESET="${ADMIN_CIDR_RESET:-0}"
ADMIN_CIDR_RESET="${ADMIN_CIDR_RESET//$'\r'/}"
EXISTING_ADMIN_CIDRS=""
if [[ "${ADMIN_CIDR_RESET}" != "1" ]]; then
  EXISTING_ADMIN_CIDRS="$(hcloud firewall describe "${FIREWALL_NAME}" -o json 2>/dev/null \
    | jq -r '(.rules // []) | map(select(.direction=="in" and .protocol=="tcp" and .port=="6443")) | .[].source_ips[]?' \
    | tr -d '\r' \
    || true)"
fi
ADMIN_CIDRS_JSON="$(printf '%s\n%s\n' "${EXISTING_ADMIN_CIDRS}" "${ADMIN_CIDR}" \
  | tr -d '\r' \
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
# 2b. Private network
############################
NETWORK_ID=""
if [[ "${WORKER_COUNT}" -gt 0 ]]; then
  if ! hcloud network describe "${NETWORK_NAME}" >/dev/null 2>&1; then
    log "Creating private network '${NETWORK_NAME}' (${NETWORK_RANGE})"
    hcloud network create --name "${NETWORK_NAME}" --ip-range "${NETWORK_RANGE}" >/dev/null
    hcloud network add-subnet "${NETWORK_NAME}" --network-zone "${NETWORK_ZONE}" --type cloud --ip-range "10.0.0.0/24" >/dev/null
  else
    log "Private network '${NETWORK_NAME}' already exists, reusing it"
  fi
  NETWORK_ID="$(hcloud network describe "${NETWORK_NAME}" -o json | jq -r .id | tr -d '\r')"
fi

############################
# 3. Server (Control plane)
############################
SERVER_NET_ARGS=()
if [[ "${WORKER_COUNT}" -gt 0 ]]; then
  SERVER_NET_ARGS=(--network "${NETWORK_NAME}")
fi

if ! hcloud server describe "${SERVER_NAME}" >/dev/null 2>&1; then
  log "Creating server '${SERVER_NAME}' (${SERVER_TYPE}, ${SERVER_LOCATION}, ${SERVER_IMAGE})"
  hcloud server create \
    --name       "${SERVER_NAME}" \
    --type       "${SERVER_TYPE}" \
    --image      "${SERVER_IMAGE}" \
    --location   "${SERVER_LOCATION}" \
    --ssh-key    "${SSH_KEY_NAME}" \
    --firewall   "${FIREWALL_NAME}" \
    ${SERVER_NET_ARGS[@]+"${SERVER_NET_ARGS[@]}"} \
    --start-after-create >/dev/null
else
  log "Server '${SERVER_NAME}' already exists, reusing it"
  if [[ "${WORKER_COUNT}" -gt 0 ]]; then
    if ! hcloud server describe "${SERVER_NAME}" -o json | jq -e --argjson net_id "${NETWORK_ID}" '.private_net[]? | select(.network == $net_id)' >/dev/null 2>&1; then
      log "Attaching server '${SERVER_NAME}' to private network '${NETWORK_NAME}'"
      hcloud server attach-to-network "${SERVER_NAME}" --network "${NETWORK_NAME}" >/dev/null
    fi
  fi
fi

SERVER_IP="$(hcloud server ip "${SERVER_NAME}" | tr -d '\r')"
log "Server public IPv4: ${SERVER_IP}"

SERVER_PRIVATE_IP=""
if [[ "${WORKER_COUNT}" -gt 0 ]]; then
  SERVER_PRIVATE_IP="$(hcloud server describe "${SERVER_NAME}" -o json | jq -r --argjson net_id "${NETWORK_ID}" '(.private_net[]? | select(.network == $net_id) | .ip) // empty' | tr -d '\r')"
  if [[ -z "${SERVER_PRIVATE_IP}" ]]; then
    echo "Could not determine private IP for server '${SERVER_NAME}' on network '${NETWORK_NAME}' (ID: ${NETWORK_ID})" >&2
    exit 1
  fi
  log "Server private IP: ${SERVER_PRIVATE_IP}"
fi

############################
# 4. Wait for DNS
############################
dns_lookup_a() {
  curl -sS -H 'accept: application/dns-json' \
    "https://cloudflare-dns.com/dns-query?name=${DOMAIN}&type=A" \
    | jq -r '.Answer // [] | map(select(.type==1)) | .[].data' 2>/dev/null \
    | tr -d '\r'
}

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

  DNS_TIMEOUT="${DNS_TIMEOUT:-1800}"
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
# 5. Wait for SSH
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
# 6. Install k3s
############################
RESOLV_CONF_ARG=""
if $SSH '[[ -e /run/systemd/resolve/resolv.conf ]]' 2>/dev/null; then
  RESOLV_CONF_ARG="--resolv-conf=/run/systemd/resolve/resolv.conf"
fi

EXTRA_K3S_ARGS="${RESOLV_CONF_ARG}"
if [[ "${WORKER_COUNT}" -gt 0 ]]; then
  SERVER_PRIVATE_IFACE="$($SSH "ip -o -4 addr show to ${NETWORK_RANGE}" | awk '{print $2; exit}' | tr -d '\r')"
  if [[ -z "${SERVER_PRIVATE_IFACE}" ]]; then
    SERVER_PRIVATE_IFACE="$($SSH "ip -o -4 addr show to ${SERVER_PRIVATE_IP}" | awk '{print $2; exit}' | tr -d '\r')"
  fi
  FLANNEL_IFACE_ARG=""
  if [[ -n "${SERVER_PRIVATE_IFACE}" ]]; then
    FLANNEL_IFACE_ARG="--flannel-iface=${SERVER_PRIVATE_IFACE}"
  fi
  EXTRA_K3S_ARGS="${EXTRA_K3S_ARGS} --tls-san=${SERVER_PRIVATE_IP} --node-ip=${SERVER_PRIVATE_IP} --advertise-address=${SERVER_PRIVATE_IP} ${FLANNEL_IFACE_ARG}"
fi

log "Installing k3s on the control plane server"
if ! $SSH "curl -sfL https://get.k3s.io | \
      INSTALL_K3S_CHANNEL=${K3S_CHANNEL} \
      INSTALL_K3S_EXEC='--tls-san=${DOMAIN} --tls-san=${SERVER_IP} ${EXTRA_K3S_ARGS} --write-kubeconfig-mode=644' \
      sh -" >/dev/null; then
  warn "k3s installation failed on the control plane. Systemd service logs:"
  $SSH "journalctl -u k3s.service --no-pager -n 50" >&2 || true
  exit 1
fi

log "Fetching kubeconfig to ${KUBECONFIG_FILE}"
$SSH 'cat /etc/rancher/k3s/k3s.yaml' \
  | sed "s#https://127.0.0.1:6443#https://${SERVER_IP}:6443#" \
  > "${KUBECONFIG_FILE}"
chmod 600 "${KUBECONFIG_FILE}"

log "Waiting for the control plane node to become Ready"
kubectl wait --for=condition=Ready node --all --timeout=180s

############################
# 6b. Worker nodes (for multi-VM cluster)
############################
if [[ "${WORKER_COUNT}" -gt 0 ]]; then
  log "Fetching k3s node token for worker join"
  NODE_TOKEN="$($SSH 'cat /var/lib/rancher/k3s/server/node-token' | tr -d '\r')"

  for (( i=1; i<=WORKER_COUNT; i++ )); do
    WORKER_NAME="${SERVER_NAME}-worker-${i}"
    if ! hcloud server describe "${WORKER_NAME}" >/dev/null 2>&1; then
      log "Creating worker server '${WORKER_NAME}' (${WORKER_TYPE}, ${SERVER_LOCATION}, ${SERVER_IMAGE})"
      hcloud server create \
        --name       "${WORKER_NAME}" \
        --type       "${WORKER_TYPE}" \
        --image      "${SERVER_IMAGE}" \
        --location   "${SERVER_LOCATION}" \
        --ssh-key    "${SSH_KEY_NAME}" \
        --firewall   "${FIREWALL_NAME}" \
        --network    "${NETWORK_NAME}" \
        --start-after-create >/dev/null
    else
      log "Worker server '${WORKER_NAME}' already exists, reusing it"
      if ! hcloud server describe "${WORKER_NAME}" -o json | jq -e --argjson net_id "${NETWORK_ID}" '.private_net[]? | select(.network == $net_id)' >/dev/null 2>&1; then
        log "Attaching worker server '${WORKER_NAME}' to private network '${NETWORK_NAME}'"
        hcloud server attach-to-network "${WORKER_NAME}" --network "${NETWORK_NAME}" >/dev/null
      fi
    fi

    WORKER_IP="$(hcloud server ip "${WORKER_NAME}" | tr -d '\r')"
    WORKER_PRIVATE_IP="$(hcloud server describe "${WORKER_NAME}" -o json | jq -r --argjson net_id "${NETWORK_ID}" '(.private_net[]? | select(.network == $net_id) | .ip) // empty' | tr -d '\r')"
    if [[ -z "${WORKER_PRIVATE_IP}" ]]; then
      echo "Could not determine private IP for worker server '${WORKER_NAME}' on network '${NETWORK_NAME}' (ID: ${NETWORK_ID})" >&2
      exit 1
    fi

    log "Waiting for SSH on worker '${WORKER_NAME}' (${WORKER_IP})"
    for retry in {1..60}; do
      if ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
             -o ConnectTimeout=5 -i "${SSH_KEY_FILE}" \
             "root@${WORKER_IP}" 'true' 2>/dev/null; then
        break
      fi
      printf '.'
      sleep 5
    done

    WORKER_SSH="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i ${SSH_KEY_FILE} root@${WORKER_IP}"

    WORKER_RESOLV_CONF_ARG=""
    if $WORKER_SSH '[[ -e /run/systemd/resolve/resolv.conf ]]' 2>/dev/null; then
      WORKER_RESOLV_CONF_ARG="--resolv-conf=/run/systemd/resolve/resolv.conf"
    fi

    WORKER_PRIVATE_IFACE="$($WORKER_SSH "ip -o -4 addr show to ${NETWORK_RANGE}" | awk '{print $2; exit}' | tr -d '\r')"
    if [[ -z "${WORKER_PRIVATE_IFACE}" ]]; then
      WORKER_PRIVATE_IFACE="$($WORKER_SSH "ip -o -4 addr show to ${WORKER_PRIVATE_IP}" | awk '{print $2; exit}' | tr -d '\r')"
    fi
    WORKER_FLANNEL_IFACE_ARG=""
    if [[ -n "${WORKER_PRIVATE_IFACE}" ]]; then
      WORKER_FLANNEL_IFACE_ARG="--flannel-iface=${WORKER_PRIVATE_IFACE}"
    fi

    log "Joining worker '${WORKER_NAME}' to the cluster"
    if ! $WORKER_SSH "curl -sfL https://get.k3s.io | \
      INSTALL_K3S_CHANNEL=${K3S_CHANNEL} \
      K3S_URL='https://${SERVER_PRIVATE_IP}:6443' \
      K3S_TOKEN='${NODE_TOKEN}' \
      INSTALL_K3S_EXEC='--node-ip=${WORKER_PRIVATE_IP} ${WORKER_FLANNEL_IFACE_ARG} ${WORKER_RESOLV_CONF_ARG}' \
      sh -" >/dev/null; then
      warn "k3s agent join failed on worker '${WORKER_NAME}'. Systemd service logs:"
      $WORKER_SSH "journalctl -u k3s-agent.service --no-pager -n 50" >&2 || true
      exit 1
    fi
  done

  TOTAL_NODES=$(( WORKER_COUNT + 1 ))
  log "Waiting for all ${TOTAL_NODES} nodes to become Ready"
  kubectl wait --for=condition=Ready node --all --timeout=180s
fi

############################
# 7. Configure Traefik
############################
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

log "Waiting for Traefik to reconcile with the new configuration"
TRAEFIK_READY=0
for i in {1..60}; do
  if kubectl -n kube-system get deploy traefik >/dev/null 2>&1; then
    TRAEFIK_READY=1
    break
  fi
  FAILING_POD="$(kubectl -n kube-system get pods \
    -l 'helmcharts.helm.cattle.io/chart=traefik' \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.containerStatuses[*].state.waiting.reason}{"\n"}{end}' 2>/dev/null \
    | tr -d '\r' \
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
# 8. Cookie parser secret
############################
if [[ ! -s "${COOKIE_SECRET_FILE}" ]]; then
  log "Generating persistent cookieParserSecret at ${COOKIE_SECRET_FILE}"
  set +o pipefail
  LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 24 > "${COOKIE_SECRET_FILE}"
  set -o pipefail
  chmod 600 "${COOKIE_SECRET_FILE}"
fi
COOKIE_PARSER_SECRET="$(cat "${COOKIE_SECRET_FILE}" | tr -d '\r')"

############################
# 9. LLM gateway secret (optional)
############################
HELM_LLM_ARGS=()
if [[ -n "${LLM_API_KEY}" ]]; then
  log "Configuring LLM gateway (model=${LLM_MODEL}, apiUrl=${LLM_API_URL})"
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
  ${HELM_LLM_ARGS[@]+"${HELM_LLM_ARGS[@]}"}

kubectl -n default rollout status deploy/multi-juicer --timeout=180s

############################
# 11. Request and verify Let's Encrypt certificate
############################
log "Requesting a Let's Encrypt certificate for ${DOMAIN}"
curl --insecure --silent --show-error --noproxy "${DOMAIN}" \
  --resolve "${DOMAIN}:443:${SERVER_IP}" \
  --connect-timeout 10 --max-time 20 \
  -o /dev/null "https://${DOMAIN}/" >/dev/null 2>&1 || true

LE_CERTIFICATE_ISSUED=0
LE_CERTIFICATE_DETAILS=""
SECONDS=0
while (( SECONDS < LE_TIMEOUT )); do
  LE_CERTIFICATE_DETAILS="$(
    printf '' | openssl s_client -connect "${SERVER_IP}:443" -servername "${DOMAIN}" -showcerts 2>/dev/null \
      | openssl x509 -noout -issuer -subject -ext subjectAltName 2>/dev/null \
      | tr -d '\r' || true
  )"

  if curl --silent --show-error --noproxy "${DOMAIN}" \
      --resolve "${DOMAIN}:443:${SERVER_IP}" \
      --connect-timeout 10 --max-time 20 \
      -o /dev/null "https://${DOMAIN}/" >/dev/null 2>&1 \
    && grep -qi "Let's Encrypt" <<<"${LE_CERTIFICATE_DETAILS}"; then
    LE_CERTIFICATE_ISSUED=1
    break
  fi

  (( SECONDS < LE_TIMEOUT )) || break
  sleep 5
  printf '.'
done
LE_WAITED="${SECONDS}"

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
ADMIN_PW="$(kubectl get secret multi-juicer-secret -o jsonpath='{.data.adminPassword}' | base64 -d | tr -d '\r')"

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
  Cluster nodes:    $(( WORKER_COUNT + 1 )) (1 control plane$([[ "${WORKER_COUNT}" -gt 0 ]] && echo ", ${WORKER_COUNT} workers"))
  LLM gateway:      ${LLM_STATUS}

  Kubeconfig:       ${KUBECONFIG_FILE}
  SSH into server:  ssh -i ${SSH_KEY_FILE} root@${SERVER_IP}
  Cookie secret:    ${COOKIE_SECRET_FILE} (keep it — re-runs reuse it so team sessions survive helm upgrades)

The setup script requested and verified the certificate above. If it printed a
warning instead, inspect the Traefik ACME logs it included, fix the reported
DNS or HTTP-01 reachability issue, and re-run setup.sh.
EOF

action "After the event: run ./teardown.sh to delete every Hetzner resource (servers, private network, firewall, SSH key) created by this script"
cat <<EOF

  The A record for ${DOMAIN} at your DNS provider is *not* touched — remove it there
  manually if you no longer need it.
EOF
