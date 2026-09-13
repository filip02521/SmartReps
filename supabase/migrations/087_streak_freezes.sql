-- 087: Streak freezes (Pro perk)
--
-- Append-only event log: 'grant' rows accrue a freeze (1/month while Pro),
-- 'use' rows mark a skipped week as covered by the weekly streak. Clients use
-- deterministic ids ('grant-YYYY-MM' / 'use-YYYY-MM-DD') so cross-device sync
-- is idempotent. Rows are never updated or deleted.
--
-- The insert trigger enforces Pro server-side: without it, any authenticated
-- user could self-insert 'use' rows → fabricated streak weeks → fake
-- streak_* achievements synced to their public profile showcase.

create table if not exists public.streak_freezes (
  id text not null,
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('grant', 'use')),
  -- 'use' rows: local Monday of the frozen week (client-computed, text to
  -- avoid timezone drift — the week key is already normalized client-side).
  week_key text null,
  -- 'grant' rows: grant month 'YYYY-MM'.
  month_key text null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (
    (kind = 'grant' and month_key is not null and week_key is null)
    or (kind = 'use' and week_key is not null and month_key is null)
  )
);

-- One grant per user per month; one freeze per week (defense-in-depth —
-- deterministic ids already dedupe, the indexes make it structural).
create unique index if not exists streak_freezes_grant_month_idx
  on public.streak_freezes (user_id, month_key) where kind = 'grant';
create unique index if not exists streak_freezes_use_week_idx
  on public.streak_freezes (user_id, week_key) where kind = 'use';

alter table public.streak_freezes enable row level security;

create policy "streak_freezes_own" on public.streak_freezes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Pro gate on inserts ──
create or replace function public.streak_freezes_require_pro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_expires timestamptz;
begin
  -- service_role (edge functions) and direct SQL (auth.role() is null when
  -- no JWT claims exist — console/migrations) bypass the check. PostgREST
  -- always sets a role, so null never comes from API traffic.
  if auth.role() is null or auth.role() = 'service_role' then
    return new;
  end if;

  select subscription_status, subscription_expires_at
  into v_status, v_expires
  from public.profiles
  where id = new.user_id;

  if not (
    v_status = 'lifetime'
    or (v_status in ('pro', 'trial') and (v_expires is null or v_expires > now()))
  ) then
    raise exception 'streak_freeze_requires_pro';
  end if;
  return new;
end;
$$;

drop trigger if exists streak_freezes_require_pro on public.streak_freezes;
create trigger streak_freezes_require_pro
  before insert on public.streak_freezes
  for each row execute function public.streak_freezes_require_pro();
