#!/usr/bin/env bash
# Shell-agnostic note: this script is intended to be SOURCED so that `export`s persist in your current shell.
# Usage:
#   source scripts/setup-env.sh            # interactive prompts for any missing vars
#   # or provide values upfront
#   GOOGLE_STREET_VIEW_API_KEY=... GOOGLE_MAPS_API_KEY=... GOOGLE_PLACES_API_KEY=... \
#     source scripts/setup-env.sh

set -euo pipefail

# Detect if the script is being sourced (required for exports to persist)
# In bash, BASH_SOURCE is defined; in zsh, use $ZSH_EVAL_CONTEXT
_is_sourced=false
if [ -n "${BASH_SOURCE:-}" ]; then
  if [ "${BASH_SOURCE[0]}" != "$0" ]; then _is_sourced=true; fi
elif [ -n "${ZSH_EVAL_CONTEXT:-}" ]; then
  case $ZSH_EVAL_CONTEXT in *:file) _is_sourced=true;; esac
fi

if [ "$_is_sourced" != true ]; then
  echo "[setup-env] Please source this script so exports persist:"
  echo "  source scripts/setup-env.sh"
  exit 1
fi

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[setup-env] Missing required command: $1" >&2; return 1; }; }

# Optional: openssl for strong JWT generation
if ! require_cmd openssl; then
  echo "[setup-env] openssl not found; you can install it or set JWT_SECRET manually before sourcing."
fi

# Prompt helper (silent when requested)
prompt_secret() {
  local varname="$1"; local prompt="$2"; local silent="${3:-}"; local input=""
  if [ -n "${!varname:-}" ]; then return 0; fi
  if [ -n "$silent" ]; then
    read -r -s -p "$prompt: " input; echo
  else
    read -r -p "$prompt: " input
  fi
  export "$varname"="$input"
}

# 1) JWT Secret - generate if not provided
if [ -z "${JWT_SECRET:-}" ]; then
  if command -v openssl >/dev/null 2>&1; then
    export JWT_SECRET="$(openssl rand -base64 48)"  # >= 32 bytes strength
    echo "[setup-env] Generated JWT_SECRET (base64, 48 bytes)."
  else
    prompt_secret JWT_SECRET "Enter JWT_SECRET (recommend: openssl rand -base64 48)" secret
  fi
fi

# 2) Google API keys (never hardcode in script; prompt if missing)
if [ -z "${GOOGLE_STREET_VIEW_API_KEY:-}" ]; then
  prompt_secret GOOGLE_STREET_VIEW_API_KEY "Enter GOOGLE_STREET_VIEW_API_KEY" secret
fi
if [ -z "${GOOGLE_MAPS_API_KEY:-}" ]; then
  prompt_secret GOOGLE_MAPS_API_KEY "Enter GOOGLE_MAPS_API_KEY (used server-side for geocoding)" secret
fi
if [ -z "${GOOGLE_PLACES_API_KEY:-}" ]; then
  prompt_secret GOOGLE_PLACES_API_KEY "Enter GOOGLE_PLACES_API_KEY (backend-only Places proxy)" secret
fi

# 3) Origins and DB (defaults provided)
export CORS_ORIGIN="${CORS_ORIGIN:-https://itsgarages.itsfait.com}"
export FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-https://itsgarages.itsfait.com}"
export DATABASE_URL="${DATABASE_URL:-sqlite:./garage_game.db}"

# 4) Quick validation
missing=()
for v in JWT_SECRET GOOGLE_STREET_VIEW_API_KEY GOOGLE_MAPS_API_KEY GOOGLE_PLACES_API_KEY CORS_ORIGIN FRONTEND_ORIGIN DATABASE_URL; do
  if [ -z "${!v:-}" ]; then missing+=("$v"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "[setup-env] Missing required variables: ${missing[*]}" >&2
  return 1
fi

# 5) Summary (mask secrets)
mask() { local x="$1"; [ ${#x} -le 6 ] && echo "***" || echo "${x:0:4}***${x: -4}"; }
cat <<EOF
[setup-env] Environment ready. Summary (secrets masked):
  CORS_ORIGIN        = $CORS_ORIGIN
  FRONTEND_ORIGIN    = $FRONTEND_ORIGIN
  DATABASE_URL       = $DATABASE_URL
  JWT_SECRET         = $(mask "$JWT_SECRET")
  STREET_VIEW_KEY    = $(mask "$GOOGLE_STREET_VIEW_API_KEY")
  MAPS_KEY           = $(mask "$GOOGLE_MAPS_API_KEY")
  PLACES_KEY         = $(mask "$GOOGLE_PLACES_API_KEY")

Next:
  1) Run deployment:  bash garage-door-game/deploy-cloudrun.sh
  2) After deploy, get your frontend Cloud Run URL and update FRONTEND_ORIGIN, then redeploy:
     export FRONTEND_ORIGIN='https://<your-frontend>.run.app'
     bash garage-door-game/deploy-cloudrun.sh
EOF

