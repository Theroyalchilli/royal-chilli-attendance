#!/usr/bin/env bash
# One-time Vercel setup for royal-chilli-attendance.
# Run from this directory:  bash deploy-setup.sh
#
# Creates/links a new Vercel project, uploads the env vars from .env.local to
# all three environments, and does a first production deploy.

set -e
cd "$(dirname "$0")"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Vercel CLI not found. Install it: npm i -g vercel"
  exit 1
fi
if [ ! -f .env.local ]; then
  echo ".env.local missing — copy .env.local.example and fill it in first."
  exit 1
fi

echo "→ Linking / creating the Vercel project…"
vercel link --yes

echo "→ Uploading environment variables…"
while IFS='=' read -r key value; do
  case "$key" in ""|\#*) continue ;; esac
  for env in production preview development; do
    # remove any existing value, then add (ignore 'not found' on first run)
    vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$key" "$env" >/dev/null
  done
  echo "   set $key"
done < .env.local

echo "→ Deploying to production…"
vercel --prod

echo
echo "Done. Note the URL above (…vercel.app). The subdomain comes in Phase 8."
