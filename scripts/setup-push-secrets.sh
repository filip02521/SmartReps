#!/usr/bin/env bash
# Optional: also set Deno Edge Secrets (requires `npx supabase login`).
# Runtime already works via public.push_config when seeded.
# Usage:
#   export VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... CRON_SECRET=...
#   ./scripts/setup-push-secrets.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROJECT_REF="${SUPABASE_PROJECT_REF:-pwfymoxjrgnovzcmmfyn}"

: "${VAPID_PUBLIC_KEY:?Set VAPID_PUBLIC_KEY}"
: "${VAPID_PRIVATE_KEY:?Set VAPID_PRIVATE_KEY}"
: "${CRON_SECRET:?Set CRON_SECRET}"
VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:hello@smartreps.app}"

cd "$ROOT"
npx supabase secrets set --project-ref "$PROJECT_REF" \
  "VAPID_PUBLIC_KEY=$VAPID_PUBLIC_KEY" \
  "VAPID_PRIVATE_KEY=$VAPID_PRIVATE_KEY" \
  "VAPID_SUBJECT=$VAPID_SUBJECT" \
  "CRON_SECRET=$CRON_SECRET"

echo "OK — Edge secrets set on project $PROJECT_REF"
echo "Function URL: https://${PROJECT_REF}.supabase.co/functions/v1/send-workout-reminders"
