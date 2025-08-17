#!/usr/bin/env bash
# Wrapper for Cloud Run deployment with basic checks and helpful messages.
# Usage:
#   bash scripts/deploy.sh

set -euo pipefail

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[deploy] Missing required command: $1" >&2; exit 1; }; }

require_cmd gcloud

# Ensure env vars exist (user should have sourced scripts/setup-env.sh)
missing=()
for v in JWT_SECRET GOOGLE_STREET_VIEW_API_KEY GOOGLE_MAPS_API_KEY GOOGLE_PLACES_API_KEY CORS_ORIGIN FRONTEND_ORIGIN; do
  if [ -z "${!v:-}" ]; then missing+=("$v"); fi
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "[deploy] Missing required env vars: ${missing[*]}" >&2
  echo "[deploy] Tip: source scripts/setup-env.sh to set them interactively." >&2
  exit 1
fi

# Check gcloud auth and project
if ! gcloud auth list --format="value(account)" | grep -q "@"; then
  echo "[deploy] You are not authenticated with gcloud. Running gcloud auth login..."
  gcloud auth login
fi

PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" = "(unset)" ]; then
  echo "[deploy] No gcloud project set. Please run: gcloud config set project <PROJECT_ID>" >&2
  exit 1
fi

# Run the repo deploy script
echo "[deploy] Deploying to Cloud Run in project $PROJECT_ID..."
set +e
bash garage-door-game/deploy-cloudrun.sh
code=$?
set -e

if [ $code -ne 0 ]; then
  echo "[deploy] Deployment failed (exit $code). Common issues:"
  echo "  - Missing/incorrect env vars (ensure setup-env.sh was sourced)"
  echo "  - gcloud needs reauthentication (run gcloud auth login)"
  echo "  - Project/region mismatch (review deploy-cloudrun.sh config)"
  exit $code
fi

echo "[deploy] Deployment completed successfully."

# Print quick follow-ups
echo "[deploy] If you need to allow your run.app frontend origin, set FRONTEND_ORIGIN and redeploy:"
echo "  export FRONTEND_ORIGIN='https://<your-frontend>.run.app' && bash garage-door-game/deploy-cloudrun.sh"

