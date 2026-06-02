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

usage() {
  cat <<'EOF'
Usage:
  bash scripts/bbb-feedback.sh logs <local|remote> [--limit N] [--tail N] [--intent TYPE] [--before UNIX_MS] [--compact] [--no-color] [--api-order]
  bash scripts/bbb-feedback.sh cleanup <local|remote>

Examples:
  bash scripts/bbb-feedback.sh logs local
  bash scripts/bbb-feedback.sh logs remote --tail 10 --compact
  bash scripts/bbb-feedback.sh logs remote --limit 10 --intent feedback
  bash scripts/bbb-feedback.sh logs remote --before 1717286400123
  bash scripts/bbb-feedback.sh cleanup remote
EOF
}

if [[ $# -lt 2 ]]; then
  usage
  exit 1
fi

ACTION="$1"
TARGET="$2"
shift 2

case "${TARGET}" in
  local)
    BASE_URL="http://localhost:8787"
    ORIGIN_HEADER="Origin: http://localhost:5174"
    ;;
  remote)
    BASE_URL="https://bbb-api.itsbananasutra.workers.dev"
    ORIGIN_HEADER="Origin: https://bananasutra.com"
    ;;
  *)
    echo "Unknown target: ${TARGET}. Use local or remote."
    exit 1
    ;;
esac

TOKEN="${BBB_ADMIN_TOKEN:-$(read_dev_var BBB_ADMIN_TOKEN)}"
if [[ "${TOKEN}" == "PASTE_TOKEN" || "${TOKEN}" == "YOUR_REAL_BBB_ADMIN_TOKEN" || "${TOKEN}" == "<paste_actual_token>" ]]; then
  TOKEN="$(read_dev_var BBB_ADMIN_TOKEN)"
fi
if [[ -z "${TOKEN}" ]]; then
  echo "Missing BBB_ADMIN_TOKEN."
  echo "Set it in environment or .dev.vars:"
  echo "  BBB_ADMIN_TOKEN=..."
  exit 1
fi

if [[ "${ACTION}" == "cleanup" ]]; then
  curl -sS -X POST "${BASE_URL}/api/bbb/admin/feedback/cleanup" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "${ORIGIN_HEADER}" \
    -H "Content-Type: application/json"
  echo
  exit 0
fi

if [[ "${ACTION}" != "logs" ]]; then
  echo "Unknown action: ${ACTION}. Use logs or cleanup."
  exit 1
fi

LIMIT="50"
TAIL=""
INTENT=""
BEFORE=""
COMPACT="0"
NO_COLOR="0"
API_ORDER="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)
      LIMIT="${2:-}"
      shift 2
      ;;
    --tail)
      TAIL="${2:-}"
      shift 2
      ;;
    --intent)
      INTENT="${2:-}"
      shift 2
      ;;
    --before)
      BEFORE="${2:-}"
      shift 2
      ;;
    --compact)
      COMPACT="1"
      shift 1
      ;;
    --no-color)
      NO_COLOR="1"
      shift 1
      ;;
    --api-order)
      API_ORDER="1"
      shift 1
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -n "${TAIL}" ]]; then
  LIMIT="${TAIL}"
  if [[ "${COMPACT}" == "0" ]]; then
    COMPACT="1"
  fi
fi

URL="${BASE_URL}/api/bbb/admin/feedback?limit=${LIMIT}"
if [[ -n "${INTENT}" ]]; then
  URL="${URL}&intent_type=${INTENT}"
fi
if [[ -n "${BEFORE}" ]]; then
  URL="${URL}&before=${BEFORE}"
fi

RAW="$(curl -sS "${URL}" -H "Authorization: Bearer ${TOKEN}" -H "${ORIGIN_HEADER}")"

FORMAT="${BBB_FEEDBACK_FORMAT:-pretty}"
if [[ "${FORMAT}" == "json" ]]; then
  echo "${RAW}"
  exit 0
fi

BBB_FEEDBACK_COMPACT="${COMPACT}" BBB_FEEDBACK_NO_COLOR="${NO_COLOR}" BBB_FEEDBACK_API_ORDER="${API_ORDER}" python3 - "${RAW}" <<'PYEOF'
import datetime
import json
import os
import sys
import textwrap

SEP = "-" * 70
COMPACT = os.environ.get("BBB_FEEDBACK_COMPACT") == "1"
NO_COLOR = os.environ.get("BBB_FEEDBACK_NO_COLOR") == "1"
API_ORDER = os.environ.get("BBB_FEEDBACK_API_ORDER") == "1"
USE_COLOR = (not NO_COLOR) and sys.stdout.isatty()

COLOR = {
    "reset": "\033[0m",
    "green": "\033[32m",
    "red": "\033[31m",
    "yellow": "\033[33m",
    "cyan": "\033[36m",
    "dim": "\033[2m",
}

def c(text, name):
    if not USE_COLOR:
        return text
    return f"{COLOR[name]}{text}{COLOR['reset']}"

def fmt_time(ms):
    try:
        dt = datetime.datetime.fromtimestamp(ms / 1000, tz=datetime.timezone.utc)
        local = dt.astimezone()
        return local.strftime("%b %d, %Y  %I:%M %p").replace("  0", "  ")
    except Exception:
        return str(ms)

def wrap(text, width=90, indent="  "):
    if not text:
        return indent + "(empty)"
    lines = text.strip().split("\n")
    wrapped = []
    for line in lines:
        if not line.strip():
            wrapped.append("")
        else:
            wrapped.extend(textwrap.wrap(line, width=width))
    return "\n".join(indent + l for l in wrapped)

def short(text, max_len=120):
    t = (text or "").strip().replace("\n", " ")
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"

def status_style(status):
    if status == "delivered":
        return c(status, "green")
    if status in ("apps_script_error", "dropped"):
        return c(status, "red")
    return c(status, "yellow")

try:
    data = json.loads(sys.argv[1])
except Exception:
    print(sys.argv[1])
    sys.exit(0)

logs = data.get("logs", [])
if not logs:
    print("No feedback rows found.")
    sys.exit(0)

display_logs = logs if API_ORDER else list(reversed(logs))
next_before = data.get("nextBefore")

print()
print(c(SEP, "dim"))
if API_ORDER:
    print("  %d feedback row(s) — #1 = newest (API order)" % len(logs))
else:
    print("  %d feedback row(s) — newest at bottom (#%d = latest)" % (len(logs), len(logs)))
if next_before:
    print("  Older page: npm run feedback:remote -- --before %s" % c(str(next_before), "yellow"))
print(c(SEP, "dim"))

for i, log in enumerate(display_logs):
    ts = fmt_time(log.get("created_at", 0))
    intent = log.get("intent_type", "?")
    status = log.get("delivery_status", "?")
    name = log.get("name", "") or ""
    email = log.get("email", "") or ""
    message = log.get("message", "") or ""
    pathname = log.get("pathname", "") or ""
    error = log.get("delivery_error", "") or ""
    request_id = log.get("request_id", "") or ""

    icon = c("[ok]", "green") if status == "delivered" else c("[!!]", "red")
    status_text = status_style(status)

    print()
    print("  %s  #%d  %s   %s  %s" % (icon, i + 1, ts, c(intent, "cyan"), status_text))
    if name or email:
        print("     from:  %s <%s>" % (name or "(no name)", email or "(no email)"))
    if pathname:
        print("     page:  %s" % pathname)
    if request_id:
        print("     req:   %s" % request_id[:36])

    if COMPACT:
        print("     msg:   %s" % short(message))
        if error:
            print("     error: %s" % c(short(error), "red"))
        print(c(SEP, "dim"))
        continue

    print()
    print("  -- " + c("MESSAGE", "cyan") + " " + "-" * 58)
    print(wrap(message))
    if error:
        print()
        print("  -- " + c("DELIVERY ERROR", "red") + " " + "-" * 49)
        print(wrap(error))
    print()
    print(c(SEP, "dim"))

print()
PYEOF
