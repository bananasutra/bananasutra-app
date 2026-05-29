#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Pipe-separated list of your own ip_hash prefixes to exclude.
# Override ad hoc:
#   BBB_ME_IP_HASHES='abc123|def456' npm run logs:remote:not-me -- --before 123
ME_IP_HASHES="${BBB_ME_IP_HASHES:-6f2a652ce3bf|9395731d66d3|91c33b9261a2|598d5e1dbd61|0799af7c0d5e}"
# Pipe-separated list of your own actor_hash prefixes to exclude (preferred).
# Example:
#   BBB_ME_ACTOR_HASHES='abc123|def456' npm run logs:remote:not-me -- --limit 100
ME_ACTOR_HASHES="${BBB_ME_ACTOR_HASHES:-}"

bash "${PROJECT_ROOT}/scripts/bbb-logs.sh" logs remote "$@" | awk -v me_ips="${ME_IP_HASHES}" -v me_actors="${ME_ACTOR_HASHES}" '
function flush() {
  if (seen && !mine) printf "%s", block
  block = ""
  mine = 0
}

BEGIN {
  ip_count = split(me_ips, ip_parts, "|")
  for (i = 1; i <= ip_count; i++) {
    if (ip_parts[i] != "") mine_ip_map[ip_parts[i]] = 1
  }
  actor_count = split(me_actors, actor_parts, "|")
  for (i = 1; i <= actor_count; i++) {
    if (actor_parts[i] != "") mine_actor_map[actor_parts[i]] = 1
  }
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
    if (actor_token in mine_actor_map) mine = 1
  }
  if ($0 ~ /ip:[[:space:]]*[[:alnum:]]+/) {
    ip_token = $0
    sub(/^.*ip:[[:space:]]*/, "", ip_token)
    sub(/[^[:alnum:]].*$/, "", ip_token)
    if (ip_token in mine_ip_map) mine = 1
  }
}

END {
  flush()
}
'
