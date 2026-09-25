#!/usr/bin/env bash
#
# Delete every Hetzner resource created by ./setup.sh (control plane server,
# worker servers, private network, firewall, SSH key) and wipe the local state dir.
# The DNS A record at your provider is NOT touched — remove it manually.
#
# Required env: HCLOUD_TOKEN

set -euo pipefail

: "${HCLOUD_TOKEN:?HCLOUD_TOKEN is required}"

HCLOUD_TOKEN="${HCLOUD_TOKEN//$'\r'/}"
SERVER_NAME="${SERVER_NAME:-multi-juicer}"
SERVER_NAME="${SERVER_NAME//$'\r'/}"
SSH_KEY_NAME="${SSH_KEY_NAME:-${SERVER_NAME}-key}"
SSH_KEY_NAME="${SSH_KEY_NAME//$'\r'/}"
FIREWALL_NAME="${FIREWALL_NAME:-${SERVER_NAME}-fw}"
FIREWALL_NAME="${FIREWALL_NAME//$'\r'/}"
NETWORK_NAME="${NETWORK_NAME:-${SERVER_NAME}-net}"
NETWORK_NAME="${NETWORK_NAME//$'\r'/}"
STATE_DIR="${STATE_DIR:-$(pwd)/.multi-juicer-hetzner}"
STATE_DIR="${STATE_DIR//$'\r'/}"

export HCLOUD_TOKEN

log() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
action() { printf '\n\033[1;36m>>  %s\033[0m\n' "$*"; }

for bin in hcloud jq; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Missing required binary: $bin" >&2; exit 1; }
done

# --- Hetzner Cloud resources ---

# 1. Delete worker servers if any exist
for worker in $(hcloud server list -o json 2>/dev/null | jq -r --arg prefix "${SERVER_NAME}-worker-" '.[] | select(.name | startswith($prefix)) | .name' | tr -d '\r' || true); do
  log "Deleting worker server '${worker}'"
  hcloud server delete "${worker}" >/dev/null
done

# 2. Delete control plane server
if hcloud server describe "${SERVER_NAME}" >/dev/null 2>&1; then
  log "Deleting server '${SERVER_NAME}'"
  hcloud server delete "${SERVER_NAME}" >/dev/null
fi

# 3. Delete private network
if hcloud network describe "${NETWORK_NAME}" >/dev/null 2>&1; then
  log "Deleting private network '${NETWORK_NAME}'"
  hcloud network delete "${NETWORK_NAME}" >/dev/null
fi

# 4. Delete firewall
if hcloud firewall describe "${FIREWALL_NAME}" >/dev/null 2>&1; then
  log "Deleting firewall '${FIREWALL_NAME}'"
  hcloud firewall delete "${FIREWALL_NAME}" >/dev/null
fi

# 5. Delete SSH key
if hcloud ssh-key describe "${SSH_KEY_NAME}" >/dev/null 2>&1; then
  log "Deleting SSH key '${SSH_KEY_NAME}'"
  hcloud ssh-key delete "${SSH_KEY_NAME}" >/dev/null
fi

# 6. Delete local state
if [[ -d "${STATE_DIR}" ]]; then
  log "Removing local state at ${STATE_DIR}"
  rm -rf "${STATE_DIR}"
fi

log "Teardown complete."
action "Reminder: the A record for your domain at your DNS provider was *not* touched — remove it there manually if you no longer need it"
