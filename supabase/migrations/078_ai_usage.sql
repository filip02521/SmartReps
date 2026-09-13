-- 078: Hosted AI usage accounting
--
-- Server-side quota for the ai-proxy Edge Function. The app can send AI calls
-- through a managed proxy (SmartReps-owned provider key) instead of BYOK.
-- Quota is per user per UTC day, enforced atomically by ai_consume() so
-- concurrent requests cannot exceed the daily limit.
--
-- Access is decided by the edge function from profiles.subscription_status:
--   free → 403 pro_required (AI is Pro-only), pro/trial/lifetime → daily quota.

-- ── 1. Usage table ──
create table if not exists ai_usage_daily (
  user_id uuid not null references profiles on delete cascade,
  usage_date date not null,
  call_count integer not null default 0,
  -- Per-feature breakdown for analytics: {"post_workout": 3, ...}
  features jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);

create index if not exists ai_usage_daily_user_date_idx
  on ai_usage_daily (user_id, usage_date desc);

alter table ai_usage_daily enable row level security;

-- Users can read their own usage (shown as "remaining today" in settings).
create policy "ai_usage_daily_select_own" on ai_usage_daily
  for select using (auth.uid() = user_id);

-- No client writes — only service role (edge function) mutates this table.

-- ── 2. Atomic consume RPC ──
-- Atomically increments today's counter and returns the new count.
-- Returns -1 when the user is already at/over the limit (no increment).
-- Called by the ai-proxy edge function with the service role, so it takes
-- p_user_id explicitly (auth.uid() is null under the service role).
create or replace function public.ai_consume(
  p_user_id uuid,
  p_feature text,
  p_daily_limit integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into ai_usage_daily (user_id, usage_date, call_count, features)
  values (p_user_id, current_date, 0, '{}'::jsonb)
  on conflict (user_id, usage_date) do nothing;

  select call_count into v_count
  from ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if v_count >= p_daily_limit then
    return -1;
  end if;

  update ai_usage_daily
  set
    call_count = call_count + 1,
    features = jsonb_set(
      features,
      array[p_feature],
      to_jsonb(coalesce((features ->> p_feature)::integer, 0) + 1)
    ),
    updated_at = now()
  where user_id = p_user_id and usage_date = current_date;

  return v_count + 1;
end;
$$;

-- Only the service role (edge functions) may consume quota — clients can
-- read their own row via RLS but must never increment it directly.
revoke all on function public.ai_consume(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.ai_consume(uuid, text, integer) to service_role;

-- ── 3. Refund RPC ──
-- Returns one consumed slot when the upstream provider call fails, so users
-- are not charged quota for errors they cannot influence. Floors at 0 so a
-- double-refund can never drive the counter negative.
create or replace function public.ai_refund(
  p_user_id uuid,
  p_feature text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update ai_usage_daily
  set
    call_count = greatest(call_count - 1, 0),
    features = jsonb_set(
      features,
      array[p_feature],
      to_jsonb(greatest(coalesce((features ->> p_feature)::integer, 0) - 1, 0))
    ),
    updated_at = now()
  where user_id = p_user_id and usage_date = current_date;
end;
$$;

revoke all on function public.ai_refund(uuid, text) from public, anon, authenticated;
grant execute on function public.ai_refund(uuid, text) to service_role;
