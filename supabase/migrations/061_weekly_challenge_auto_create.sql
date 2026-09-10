-- 061_weekly_challenge_auto_create.sql
-- Auto-create weekly challenges so the feature is truly "weekly" without
-- manual intervention. A security-definer function creates the next week's
-- challenge if none exists for the upcoming ISO week.
--
-- Can be called:
--  1. By pg_cron (if installed): SELECT cron.schedule('weekly_challenge', '0 0 * * 1', $$SELECT ensure_weekly_challenge()$$);
--  2. By an edge function / Supabase scheduled function
--  3. Manually by an admin
--
-- The function rotates programs (pushups → pullups → squats → pushups) and
-- adjusts target_reps based on the program. It is idempotent — calling it
-- multiple times for the same week is safe.

-- Helper: get ISO week key for a date (e.g. "2025-W03")
create or replace function weekly_challenge_week_key(d timestamptz default now())
returns text
language plpgsql
immutable
as $$
declare
  adjusted timestamptz;
  year_start timestamptz;
  week_num int;
  yr int;
begin
  -- ISO week: Thursday determines the year
  adjusted := d + interval '3 days' - (extract(dow from d)::int || ' days')::interval;
  yr := extract(year from adjusted)::int;
  year_start := to_date(yr::text || '-01-04', 'YYYY-MM-DD')::timestamptz;
  week_num := ceil((extract(doy from adjusted)::int + extract(dow from year_start)::int - 1) / 7.0);
  return yr::text || '-W' || lpad(week_num::text, 2, '0');
end;
$$;

-- Helper: get Monday 00:00 UTC for the ISO week containing the date
create or replace function weekly_challenge_week_start(d timestamptz default now())
returns timestamptz
language plpgsql
immutable
as $$
declare
  dow int;
begin
  dow := extract(dow from d)::int;  -- 0=Sunday, 1=Monday, ...
  if dow = 0 then
    return date_trunc('day', d) - interval '6 days';
  else
    return date_trunc('day', d) - ((dow - 1)::text || ' days')::interval;
  end if;
end;
$$;

-- Main: ensure a challenge exists for the given (or current) week.
-- Rotates programs and sets target based on program.
create or replace function ensure_weekly_challenge(
  for_date timestamptz default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  wk_key text;
  wk_start timestamptz;
  wk_end timestamptz;
  existing_id uuid;
  program text;
  target_reps int;
  challenge_title text;
  challenge_desc text;
  -- Determine which program to use by rotating based on week number
  week_num int;
  program_idx int;
  programs text[] := array['pushups', 'pullups', 'squats'];
  targets int[] := array[100, 50, 120];
begin
  wk_key := weekly_challenge_week_key(for_date);
  wk_start := weekly_challenge_week_start(for_date);
  wk_end := wk_start + interval '7 days';

  -- Already exists for this week?
  select id into existing_id from weekly_challenges where week_key = wk_key;
  if existing_id is not null then
    return existing_id;
  end if;

  -- Rotate program based on week number (mod 3)
  week_num := split_part(wk_key, '-W', 2)::int;
  program_idx := ((week_num - 1) % 3) + 1;
  program := programs[program_idx];
  target_reps := targets[program_idx];

  -- Build title/description based on program
  if program = 'pushups' then
    challenge_title := 'Wyzwanie pompek';
    challenge_desc := 'Zrób jak najwięcej pompek w tym tygodniu!';
  elsif program = 'pullups' then
    challenge_title := 'Wyzwanie podciągania';
    challenge_desc := 'Zrób jak najwięcej podciągnięć w tym tygodniu!';
  else
    challenge_title := 'Wyzwanie przysiadów';
    challenge_desc := 'Zrób jak najwięcej przysiadów w tym tygodniu!';
  end if;

  insert into weekly_challenges (week_key, program, target_reps, title, description, starts_at, ends_at, is_active)
  values (wk_key, program, target_reps, challenge_title, challenge_desc, wk_start, wk_end, true)
  on conflict (week_key) do nothing
  returning id into existing_id;

  return existing_id;
end;
$$;

-- Grant execute to authenticated users (they may trigger creation on load)
-- and anon (edge functions may call without auth).
grant execute on function ensure_weekly_challenge(timestamptz) to authenticated, anon;
grant execute on function weekly_challenge_week_key(timestamptz) to authenticated, anon;
grant execute on function weekly_challenge_week_start(timestamptz) to authenticated, anon;

-- Index for fast week_key lookups
create index if not exists weekly_challenges_week_key_idx
  on weekly_challenges(week_key);
