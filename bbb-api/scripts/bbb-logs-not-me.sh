#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEV_VARS_FILE="${PROJECT_ROOT}/.dev.vars"

read_dev_var() {
  local key="$1"
  if [[ ! -f "${DEV_VARS_FILE}" ]]; then
    return 0
  fi

  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" ]] && continue
    [[ "${line}" =~ ^# ]] && continue
    if [[ "${line}" == "${key}="* ]]; then
      printf '%s\n' "${line#*=}"
      return 0
    fi
  done < "${DEV_VARS_FILE}"
}

# Pipe-separated hash prefixes (first 12 hex chars match log output).
# Merged with bbb-api/.dev.vars and optional shell env (see join_hash_lists below).
#
# Actor hashes (SHA-256 of server salt + localStorage bbb_actor_id). Same physical device
# can show multiple prefixes (localhost vs prod origin, cleared storage, different browser).
#   Mac mini:  4619a462d2de
#   Laptop:    183a65d49281 + 4336e64c5639 (same machine — two bbb_actor_id values)
#   iPhone:    a2e60ef0102a
DEFAULT_ME_IP_HASHES="6f2a652ce3bf|9395731d66d3|91c33b9261a2|598d5e1dbd61|0799af7c0d5e"
DEFAULT_ME_ACTOR_HASHES="4619a462d2de|183a65d49281|a2e60ef0102a|4336e64c5639"

DEV_ME_IP="$(read_dev_var BBB_ME_IP_HASHES)"
DEV_ME_ACTOR="$(read_dev_var BBB_ME_ACTOR_HASHES)"

# Merge pipe-separated prefix lists (defaults + .dev.vars + env) so a stale .dev.vars
# does not drop newer device hashes baked into DEFAULT_ME_*.
join_hash_lists() {
  local out="$1"
  shift
  local part
  for part in "$@"; do
    [[ -z "${part}" ]] && continue
    if [[ -z "${out}" ]]; then
      out="${part}"
    else
      out="${out}|${part}"
    fi
  done
  printf '%s' "${out}"
}

ME_IP_HASHES="$(join_hash_lists "${DEFAULT_ME_IP_HASHES}" "${DEV_ME_IP}" "${BBB_ME_IP_HASHES:-}")"
ME_ACTOR_HASHES="$(join_hash_lists "${DEFAULT_ME_ACTOR_HASHES}" "${DEV_ME_ACTOR}" "${BBB_ME_ACTOR_HASHES:-}")"

bash "${PROJECT_ROOT}/scripts/bbb-logs.sh" logs remote "$@" | awk -v me_ips="${ME_IP_HASHES}" -v me_actors="${ME_ACTOR_HASHES}" '
function load_map(raw, map,    n, i, parts) {
  n = split(raw, parts, "|")
  for (i = 1; i <= n; i++) {
    if (parts[i] != "") map[parts[i]] = 1
  }
}

function token_matches_map(token, map,    prefix) {
  if (token == "") return 0
  for (prefix in map) {
    if (prefix == "") continue
    # Prefix match either way (log output truncates hashes to 12 chars).
    if (index(token, prefix) == 1 || index(prefix, token) == 1) return 1
  }
  return 0
}

function flush() {
  if (seen && !mine) printf "%s", block
  block = ""
  mine = 0
}

BEGIN {
  load_map(me_ips, mine_ip_map)
  load_map(me_actors, mine_actor_map)
}

# Only treat real log headers as block starts (ignore markdown links in bodies).
/^[[:space:]]*\[(ok|!!)\][[:space:]]*#[0-9]+/ {
  flush()
  seen = 1
}

{
  block = block $0 ORS
  if ($0 ~ /actor:[[:space:]]*[[:alnum:]]+/) {
    actor_token = $0
    sub(/^.*actor:[[:space:]]*/, "", actor_token)
    sub(/[^[:alnum:]].*$/, "", actor_token)
    if (token_matches_map(actor_token, mine_actor_map)) mine = 1
  }
  if ($0 ~ /ip:[[:space:]]*[[:alnum:]]+/) {
    ip_token = $0
    sub(/^.*ip:[[:space:]]*/, "", ip_token)
    sub(/[^[:alnum:]].*$/, "", ip_token)
    if (token_matches_map(ip_token, mine_ip_map)) mine = 1
  }
}

END {
  flush()
}
'
