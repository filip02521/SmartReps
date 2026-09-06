-- 032_weekly_challenge.sql
-- Weekly challenge: wspólne wyzwanie tygodnia z leaderboardem.
-- Np. "Zrób 100 pompek w 5 serii" — user submituje swój wynik (najlepsza sesja w tygodniu).

-- ── Challenges table — one per ISO week ──
create table if not exists weekly_challenges (
  id uuid primary key default gen_random_uuid(),
  week_key text not null unique,  -- e.g. "2025-W03"
  program text not null check (program in ('pushups', 'pullups')),
  target_reps int not null check (target_reps > 0),
  title text not null check (char_length(title) >= 1 and char_length(title) <= 120),
  description text not null default '' check (char_length(description) <= 500),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists weekly_challenges_active_idx
  on weekly_challenges(is_active, ends_at desc);

-- ── Entries — user submissions (best result per user per challenge) ──
create table if not exists weekly_challenge_entries (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references weekly_challenges(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_reps int not null check (total_reps >= 0),
  display_name text not null default '' check (char_length(display_name) <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (challenge_id, user_id)
);

create index if not exists weekly_challenge_entries_leaderboard_idx
  on weekly_challenge_entries(challenge_id, total_reps desc);

-- ── RLS ──
alter table weekly_challenges enable row level security;
create policy weekly_challenges_select on weekly_challenges
  for select using (true);

alter table weekly_challenge_entries enable row level security;

-- Leaderboard is public (anyone can see entries)
create policy weekly_challenge_entries_select on weekly_challenge_entries
  for select using (true);

-- Users can insert/update only their own entries
create policy weekly_challenge_entries_insert on weekly_challenge_entries
  for insert with check (user_id = auth.uid());

create policy weekly_challenge_entries_update on weekly_challenge_entries
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy weekly_challenge_entries_delete on weekly_challenge_entries
  for delete using (user_id = auth.uid());

-- ── Updated_at trigger ──
create or replace function weekly_challenge_entries_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger weekly_challenge_entries_updated_at
  before update on weekly_challenge_entries
  for each row execute function weekly_challenge_entries_set_updated_at();

-- ── Helper: assert authenticated ──
create or replace function weekly_challenge_assert_authenticated()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where id = auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  return uid;
end;
$$;

-- ── RPC: get active challenge ──
create or replace function get_active_weekly_challenge()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ch weekly_challenges%rowtype;
begin
  select * into ch from weekly_challenges
  where is_active = true and starts_at <= now() and ends_at > now()
  order by starts_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', ch.id,
    'week_key', ch.week_key,
    'program', ch.program,
    'target_reps', ch.target_reps,
    'title', ch.title,
    'description', ch.description,
    'starts_at', ch.starts_at,
    'ends_at', ch.ends_at
  );
end;
$$;

-- ── RPC: submit/update entry (upsert — best result wins) ──
create or replace function submit_weekly_challenge_entry(
  p_challenge_id uuid,
  p_total_reps int,
  p_display_name text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := weekly_challenge_assert_authenticated();
  ch weekly_challenges%rowtype;
  existing_entry weekly_challenge_entries%rowtype;
  new_entry weekly_challenge_entries%rowtype;
begin
  -- Validate
  if p_total_reps < 0 then
    raise exception 'invalid_reps';
  end if;
  if char_length(p_display_name) > 60 then
    raise exception 'display_name_too_long';
  end if;

  -- Check challenge exists and is active
  select * into ch from weekly_challenges where id = p_challenge_id;
  if not found or not ch.is_active or now() < ch.starts_at or now() >= ch.ends_at then
    raise exception 'challenge_not_active';
  end if;

  -- Check existing entry — only update if new result is better
  select * into existing_entry
  from weekly_challenge_entries
  where challenge_id = p_challenge_id and user_id = uid;

  if found then
    if p_total_reps > existing_entry.total_reps then
      update weekly_challenge_entries
      set total_reps = p_total_reps, display_name = p_display_name, updated_at = now()
      where id = existing_entry.id
      returning * into new_entry;
    else
      new_entry := existing_entry;
    end if;
  else
    insert into weekly_challenge_entries (challenge_id, user_id, total_reps, display_name)
    values (p_challenge_id, uid, p_total_reps, p_display_name)
    returning * into new_entry;
  end if;

  return jsonb_build_object(
    'id', new_entry.id,
    'challenge_id', new_entry.challenge_id,
    'total_reps', new_entry.total_reps,
    'display_name', new_entry.display_name,
    'created_at', new_entry.created_at,
    'updated_at', new_entry.updated_at,
    'is_new_best', found and p_total_reps > existing_entry.total_reps
  );
end;
$$;

-- ── RPC: get leaderboard (top 50 entries) ──
create or replace function get_weekly_challenge_leaderboard(
  p_challenge_id uuid,
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  entries jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.id,
      'user_id', e.user_id,
      'total_reps', e.total_reps,
      'display_name', e.display_name,
      'created_at', e.created_at,
      'rank', row_number() over (order by e.total_reps desc, e.created_at asc)
    )
    order by e.total_reps desc, e.created_at asc
  ), '[]'::jsonb) into entries
  from weekly_challenge_entries e
  where e.challenge_id = p_challenge_id
  limit p_limit;

  return entries;
end;
$$;

-- ── RPC: get current user's entry for a challenge ──
create or replace function get_my_weekly_challenge_entry(
  p_challenge_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := weekly_challenge_assert_authenticated();
  entry weekly_challenge_entries%rowtype;
begin
  select * into entry
  from weekly_challenge_entries
  where challenge_id = p_challenge_id and user_id = uid;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', entry.id,
    'challenge_id', entry.challenge_id,
    'total_reps', entry.total_reps,
    'display_name', entry.display_name,
    'created_at', entry.created_at,
    'updated_at', entry.updated_at
  );
end;
$$;

-- ── RPC: get entry count (participants) ──
create or replace function get_weekly_challenge_participant_count(
  p_challenge_id uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  cnt int;
begin
  select count(*) into cnt
  from weekly_challenge_entries
  where challenge_id = p_challenge_id;

  return cnt;
end;
$$;
