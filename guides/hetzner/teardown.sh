#!/usr/bin/env bash
#
# Delete every Hetzner resource created by ./setup.sh:
#   - Hetzner Cloud server
#   - Hetzner Cloud firewall
#   - Hetzner Cloud SSH key
#   - Local state directory (kubeconfig, SSH key)
#
# The DNS A record for your domain is managed at your own DNS provider
# (e.g. Strato) and is *not* touched by this script — remove it there
# manually once you no longer need the deployment.
#
# Required env vars (same as setup.sh):
#   HCLOUD_TOKEN

set -euo pipefail

: "${HCLOUD_TOKEN:?HCLOUD_TOKEN is required}"

SERVER_NAME="${SERVER_NAME:-multi-juicer}"
SSH_KEY_NAME="${SSH_KEY_NAME:-${SERVER_NAME}-key}"
FIREWALL_NAME="${FIREWALL_NAME:-${SERVER_NAME}-fw}"
STATE_DIR="${STATE_DIR:-$(pwd)/.multi-juicer-hetzner}"

export HCLOUD_TOKEN

log() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }

for bin in hcloud; do
  command -v "$bin" >/dev/null 2>&1 || { echo "Missing required binary: $bin" >&2; exit 1; }
done

# --- Hetzner Cloud resources ---
if hcloud server describe "${SERVER_NAME}" >/dev/null 2>&1; then
  log "Deleting server '${SERVER_NAME}'"
  hcloud server delete "${SERVER_NAME}" >/dev/null
fi

if hcloud firewall describe "${FIREWALL_NAME}" >/dev/null 2>&1; then
  log "Deleting firewall '${FIREWALL_NAME}'"
  hcloud firewall delete "${FIREWALL_NAME}" >/dev/null
fi

if hcloud ssh-key describe "${SSH_KEY_NAME}" >/dev/null 2>&1; then
  log "Deleting SSH key '${SSH_KEY_NAME}'"
  hcloud ssh-key delete "${SSH_KEY_NAME}" >/dev/null
fi

# --- Local state ---
if [[ -d "${STATE_DIR}" ]]; then
  log "Removing local state at ${STATE_DIR}"
  rm -rf "${STATE_DIR}"
fi

log "Teardown complete."
log "Reminder: remove the A record for your domain at your DNS provider (e.g. Strato) if you no longer need it."
