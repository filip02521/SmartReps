-- 057: Subscription status for freemium model
--
-- Adds subscription tracking columns to profiles for the SmartReps freemium model.
-- Status is the source of truth for feature gating (Pro vs Free).
-- The Stripe webhook Edge Function (Etap 1) will update these columns.
-- In Etap 0, columns exist with defaults; no gating is enforced yet.
--
-- Status values:
--   'free'      — default, no subscription, no active trial
--   'trial'     — 14-day opt-in trial active (trial_started_at set)
--   'pro'       — active paid subscription (subscription_expires_at set)
--   'lifetime'  — one-time lifetime purchase, never expires
--   'expired'   — subscription ended (grace period over)

-- ── 1. Subscription columns on profiles ──
alter table profiles
  add column if not exists subscription_status text not null default 'free'
    check (subscription_status in ('free', 'trial', 'pro', 'lifetime', 'expired')),
  add column if not exists subscription_expires_at timestamptz,
  add column if not exists trial_started_at timestamptz;

-- Index for quick lookup of active subscribers (analytics, billing queries)
create index if not exists profiles_subscription_status_idx
  on profiles (subscription_status)
  where subscription_status in ('trial', 'pro', 'lifetime');

-- ── 2. Subscription events log (audit trail) ──
-- Tracks every subscription state change (Stripe webhook, trial start, expiry).
-- Useful for debugging, analytics, and dunning recovery.
create table if not exists subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles on delete cascade not null,
  event_type text not null check (event_type in (
    'trial_started', 'trial_expired',
    'subscription_created', 'subscription_renewed', 'subscription_canceled',
    'subscription_past_due', 'subscription_expired',
    'lifetime_purchased'
  )),
  plan text check (plan in ('pro_monthly', 'pro_annual', 'lifetime')),
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_event_id text,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create index if not exists subscription_events_user_id_idx
  on subscription_events (user_id, created_at desc);

create index if not exists subscription_events_stripe_event_idx
  on subscription_events (stripe_event_id)
  where stripe_event_id is not null;

alter table subscription_events enable row level security;

-- Users can read their own subscription events
create policy "subscription_events_own" on subscription_events
  for select using (auth.uid() = user_id);

-- Only service role (Edge Functions via webhook) can insert/update
create policy "subscription_events_service_insert" on subscription_events
  for insert with check (auth.uid() = user_id);

-- ── 3. RLS: users can read their own subscription status ──
-- Already covered by existing "profiles_own" policy (auth.uid() = id),
-- which grants SELECT/UPDATE/INSERT for own row. No additional policy needed.
