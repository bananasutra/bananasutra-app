#!/usr/bin/env bash
# R46-100A-31 helper: verify Apps Script failure path locally without manual secret juggling.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEV_VARS="${PROJECT_ROOT}/.dev.vars"
LOG_FILE="/tmp/bbb-wrangler-dev.log"
BAD_URL="https://example.com/not-a-real-apps-script"
BASE="http://localhost:8787"
ORIGIN="http://localhost:5174"

read_dev_var() {
  local key="$1"
  grep "^${key}=" "${DEV_VARS}" | head -1 | cut -d= -f2- || true
}

if [[ ! -f "${DEV_VARS}" ]]; then
  echo "Missing ${DEV_VARS}"
  exit 1
fi

GOOD_URL="$(read_dev_var CONTACT_ENDPOINT_URL)"
TOKEN="$(read_dev_var BBB_ADMIN_TOKEN)"
if [[ -z "${GOOD_URL}" || -z "${TOKEN}" ]]; then
  echo "Need CONTACT_ENDPOINT_URL and BBB_ADMIN_TOKEN in .dev.vars"
  exit 1
fi

stop_wrangler() {
  local pid
  pid="$(lsof -ti :8787 -sTCP:LISTEN 2>/dev/null | head -1 || true)"
  if [[ -n "${pid}" ]]; then
    kill "${pid}" 2>/dev/null || true
    sleep 1
  fi
}

start_wrangler() {
  stop_wrangler
  cd "${PROJECT_ROOT}"
  nohup npm run dev > "${LOG_FILE}" 2>&1 &
  for _ in $(seq 1 30); do
    if curl -s -o /dev/null -w '' "${BASE}/api/bbb" -X OPTIONS -H "Origin: ${ORIGIN}" 2>/dev/null; then
      return 0
    fi
    sleep 0.5
  done
  echo "Wrangler did not become ready. Tail ${LOG_FILE}"
  exit 1
}

set_contact_url() {
  local url="$1"
  python3 - "${DEV_VARS}" "${url}" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
url = sys.argv[2]
lines = path.read_text().splitlines()
out = []
found = False
for line in lines:
    if line.startswith("CONTACT_ENDPOINT_URL="):
        out.append(f"CONTACT_ENDPOINT_URL={url}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"CONTACT_ENDPOINT_URL={url}")
path.write_text("\n".join(out) + "\n")
PY
}

cleanup() {
  set_contact_url "${GOOD_URL}"
  start_wrangler >/dev/null
}
trap cleanup EXIT

echo "→ Pointing CONTACT_ENDPOINT_URL at invalid URL and restarting wrangler..."
set_contact_url "${BAD_URL}"
start_wrangler >/dev/null

echo "→ Submitting test feedback (expect relay failure)..."
RESP="$(curl -sS -X POST "${BASE}/api/bbb/feedback" \
  -H 'content-type: application/json' \
  -H "Origin: ${ORIGIN}" \
  -d '{"intentType":"feedback","message":"R46-100A-31 failure-path test","name":"QA Bot","email":"qa@example.com"}')"
echo "   response: ${RESP}"

if echo "${RESP}" | grep -q '"ok":false'; then
  echo "✓ API returned ok:false (expected)"
else
  echo "✗ Expected ok:false in response body"
  exit 1
fi

echo "→ Checking latest D1 feedback row..."
ROW="$(curl -sS "${BASE}/api/bbb/admin/feedback?limit=1" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Origin: ${ORIGIN}")"

python3 -c 'import json, sys
data = json.loads(sys.argv[1])
logs = data.get("logs") or []
if not logs:
    raise SystemExit("✗ No feedback rows returned from admin endpoint")
row = logs[0]
status = row.get("delivery_status")
if status != "apps_script_error":
    raise SystemExit(f"✗ Expected delivery_status=apps_script_error, got {status!r}")
print("✓ D1 row has delivery_status=apps_script_error")
err = row.get("delivery_error") or ""
if err:
    print(f"  delivery_error: {err[:120]}")
' "${ROW}"

echo "→ Restoring good CONTACT_ENDPOINT_URL..."
echo "✓ R46-100A-31 local failure path verified"
