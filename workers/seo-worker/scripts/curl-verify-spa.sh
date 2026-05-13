#!/usr/bin/env bash
# Curl matrix against a running Worker (`npm run dev` in workers/seo-worker).
# Usage: BASE_URL=http://127.0.0.1:8787 ./scripts/curl-verify-spa.sh

set -euo pipefail
BASE_URL="${BASE_URL:-http://127.0.0.1:8787}"

codes() {
  local path="$1"
  printf "%s GET : " "$path"
  curl -sS -o /dev/null -w "%{http_code}" "${BASE_URL}${path}" || true
  printf "\n%s HEAD: " "$path"
  curl -sS -o /dev/null -w "%{http_code}" -I "${BASE_URL}${path}" || true
  printf "\n"
}

echo "BASE_URL=$BASE_URL"
codes "/songs/curious-like-a-kiss"
codes "/songbooks"
codes "/about"

echo "Bot UA body grep (song path):"
curl -sS -A "facebookexternalhit/1.1" "${BASE_URL}/songs/curious-like-a-kiss" \
  | rg -n "og:title|canonical|<title>" || true
