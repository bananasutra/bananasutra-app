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
  bash scripts/bbb-logs.sh logs <local|remote> [--limit N] [--status VALUE] [--query TEXT] [--before UNIX_MS] [--compact] [--no-reply] [--no-color]
  bash scripts/bbb-logs.sh cleanup <local|remote>

Examples:
  bash scripts/bbb-logs.sh logs remote
  bash scripts/bbb-logs.sh logs remote --limit 25 --status ok
  bash scripts/bbb-logs.sh logs remote --query hope
  bash scripts/bbb-logs.sh logs remote --compact
  bash scripts/bbb-logs.sh logs remote --no-reply
  bash scripts/bbb-logs.sh cleanup remote
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
    ;;
  remote)
    BASE_URL="https://bbb-api.itsbananasutra.workers.dev"
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
  curl -sS -X POST "${BASE_URL}/api/bbb/admin/logs/cleanup" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Content-Type: application/json"
  echo
  exit 0
fi

if [[ "${ACTION}" != "logs" ]]; then
  echo "Unknown action: ${ACTION}. Use logs or cleanup."
  exit 1
fi

LIMIT="50"
STATUS=""
QUERY=""
BEFORE=""
COMPACT="0"
NO_REPLY="0"
NO_COLOR="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --limit)
      LIMIT="${2:-}"
      shift 2
      ;;
    --status)
      STATUS="${2:-}"
      shift 2
      ;;
    --query)
      QUERY="${2:-}"
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
    --no-reply)
      NO_REPLY="1"
      shift 1
      ;;
    --no-color)
      NO_COLOR="1"
      shift 1
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ -n "${QUERY}" ]]; then
  QUERY="$(python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))" "${QUERY}")"
fi

URL="${BASE_URL}/api/bbb/admin/logs?limit=${LIMIT}"
if [[ -n "${STATUS}" ]]; then
  URL="${URL}&status=${STATUS}"
fi
if [[ -n "${QUERY}" ]]; then
  URL="${URL}&q=${QUERY}"
fi
if [[ -n "${BEFORE}" ]]; then
  URL="${URL}&before=${BEFORE}"
fi

RAW="$(curl -sS "${URL}" -H "Authorization: Bearer ${TOKEN}")"

FORMAT="${BBB_LOG_FORMAT:-pretty}"
if [[ "${FORMAT}" == "json" ]]; then
  echo "${RAW}"
  exit 0
fi

BBB_LOG_COMPACT="${COMPACT}" BBB_LOG_NO_REPLY="${NO_REPLY}" BBB_LOG_NO_COLOR="${NO_COLOR}" python3 - "${RAW}" <<'PYEOF'
import datetime
import json
import os
import sys
import textwrap

SEP = "-" * 70
COMPACT = os.environ.get("BBB_LOG_COMPACT") == "1"
NO_REPLY = os.environ.get("BBB_LOG_NO_REPLY") == "1"
NO_COLOR = os.environ.get("BBB_LOG_NO_COLOR") == "1"
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
    if status == "ok":
        return c(status, "green")
    if status in ("upstream_error", "network_error"):
        return c(status, "red")
    return c(status, "yellow")

try:
    data = json.loads(sys.argv[1])
except Exception:
    print(sys.argv[1])
    sys.exit(0)

logs = data.get("logs", [])
if not logs:
    print("No logs found.")
    sys.exit(0)

print()
print(c(SEP, "dim"))
print("  %d log(s) returned" % len(logs))
print(c(SEP, "dim"))

for i, log in enumerate(logs):
    ts = fmt_time(log.get("created_at", 0))
    status = log.get("status", "?")
    latency = log.get("latency_ms", "?")
    model = log.get("model", "?")
    page = log.get("pathname", "") or ""
    search = log.get("search", "") or ""
    msgs = log.get("message_count", "?")
    prompt = log.get("user_prompt", "") or ""
    reply = log.get("assistant_reply", "") or ""
    error = log.get("error_message", "") or ""
    ip = log.get("ip_hash", "") or ""

    icon = c("[ok]", "green") if status == "ok" else c("[!!]", "red")
    status_text = status_style(status)

    print()
    print("  %s  #%d  %s   %s  %sms  %s msg(s)" % (icon, i + 1, ts, status_text, latency, msgs))
    print("     model: %s" % model)
    if page:
        print("     page:  %s%s" % (page, search))
    if ip:
        print("     ip:    %s..." % ip[:12])

    if COMPACT:
        print("     user:  %s" % short(prompt))
        if not NO_REPLY:
            print("     bbb:   %s" % short(reply))
        if error:
            print("     error: %s" % c(short(error), "red"))
        print(c(SEP, "dim"))
        continue

    print()
    print("  -- " + c("USER", "cyan") + " " + "-" * 60)
    print(wrap(prompt))

    if not NO_REPLY:
        print()
        print("  -- " + c("BERTRAND", "cyan") + " " + "-" * 56)
        print(wrap(reply))

    if error:
        print()
        print("  -- " + c("ERROR", "red") + " " + "-" * 59)
        print(wrap(error))

    print()
    print(c(SEP, "dim"))

next_before = data.get("nextBefore")
if next_before:
    print()
    print("  Next page: --before %s" % c(str(next_before), "yellow"))
    print()
PYEOF
