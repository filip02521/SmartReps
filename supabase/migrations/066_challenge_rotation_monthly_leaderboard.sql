-- 066_challenge_rotation_monthly_leaderboard.sql
-- Two changes:
--  1. Weekly challenge generation now ROTATES: instead of the same 12
--     challenges (3 programs × 4 types) every week, each ISO week gets a
--     deterministic subset — 2 challenge types × 3 programs = 6 challenges.
--     Type pairs rotate on a 4-week cycle and volume/consistency targets
--     scale weekly, so consecutive weeks feel different.
--  2. Monthly leaderboard RPC — one cross-week ranking per calendar month,
--     scored in points derived from existing entries (retroactive).

-- ── 1. Rotating ensure_weekly_challenge ──
-- Deterministic by week index (epoch weeks) — every client computing the
-- same week gets the identical set, so leaderboards stay global.

drop function if exists ensure_weekly_challenge(timestamptz);
create or replace function ensure_weekly_challenge(
  for_date timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  wk_key text;
  wk_start timestamptz;
  wk_end timestamptz;
  existing_ids jsonb;
  prog text;
  target_reps int;
  ch_type text;
  ch_titles jsonb;
  ch_descs jsonb;
  type_idx int;
  program_idx int;
  created_id uuid;
  week_idx int;
  sel_types text[];
  vol_scale numeric;
  programs text[] := array['pushups', 'pullups', 'squats'];
  targets int[] := array[100, 50, 120];
  -- 4-week rotation of type pairs — every type appears twice per cycle.
  -- Flat array: Postgres multidim indexing (arr[i]) returns NULL for
  -- sub-arrays — only slices (arr[i:i]) work — so keep it flat.
  type_pairs text[] := array[
    'volume', 'consistency',
    'precision', 'personal_best',
    'volume', 'personal_best',
    'consistency', 'precision'
  ];
begin
  wk_key := weekly_challenge_week_key(for_date);
  wk_start := weekly_challenge_week_start(for_date);
  wk_end := wk_start + interval '7 days';

  -- Absolute week index — continuous across year boundaries (unlike
  -- week-of-year which resets).
  week_idx := floor(extract(epoch from wk_start) / 604800)::int;
  sel_types := array[
    type_pairs[mod(week_idx, 4) * 2 + 1],
    type_pairs[mod(week_idx, 4) * 2 + 2]
  ];
  -- Volume target breathes 80% → 100% → 120% across weeks.
  vol_scale := 0.8 + 0.2 * mod(week_idx, 3);

  for program_idx in 1..3 loop
    prog := programs[program_idx];
    target_reps := targets[program_idx];

    if prog = 'pushups' then
      ch_titles := jsonb_build_object('volume', 'Mistrz Pompek', 'consistency', 'Dyscyplina Pompek', 'precision', 'Perfekcyjne Pompki', 'personal_best', 'Rekord Pompek');
      ch_descs := jsonb_build_object('volume', 'Zrób jak najwięcej pompek w tym tygodniu!', 'consistency', 'Ukończ wszystkie zaplanowane treningi pompek!', 'precision', 'Ukończ trening pompek ze wszystkimi seriami powyżej celu!', 'personal_best', 'Pobij swój rekord w teście max pompek!');
    elsif prog = 'pullups' then
      ch_titles := jsonb_build_object('volume', 'Mistrz Podciągania', 'consistency', 'Dyscyplina Podciągania', 'precision', 'Perfekcyjne Podciąganie', 'personal_best', 'Rekord Podciągania');
      ch_descs := jsonb_build_object('volume', 'Zrób jak najwięcej podciągnięć w tym tygodniu!', 'consistency', 'Ukończ wszystkie zaplanowane treningi podciągania!', 'precision', 'Ukończ trening podciągania ze wszystkimi seriami powyżej celu!', 'personal_best', 'Pobij swój rekord w teście max podciągania!');
    else
      ch_titles := jsonb_build_object('volume', 'Mistrz Przysiadów', 'consistency', 'Dyscyplina Przysiadów', 'precision', 'Perfekcyjne Przysiady', 'personal_best', 'Rekord Przysiadów');
      ch_descs := jsonb_build_object('volume', 'Zrób jak najwięcej przysiadów w tym tygodniu!', 'consistency', 'Ukończ wszystkie zaplanowane treningi przysiadów!', 'precision', 'Ukończ trening przysiadów ze wszystkimi seriami powyżej celu!', 'personal_best', 'Pobij swój rekord w teście max przysiadów!');
    end if;

    for type_idx in 1..2 loop
      ch_type := sel_types[type_idx];

      perform 1 from weekly_challenges wc
      where wc.week_key = wk_key and wc.program = prog and wc.challenge_type = ch_type;
      if found then continue; end if;

      declare
        type_target int;
      begin
        if ch_type = 'volume' then
          -- Scale weekly, round to a clean 5 (100→80/100/120 etc.)
          type_target := (round(target_reps * vol_scale / 5) * 5)::int;
        elsif ch_type = 'consistency' then
          -- Rotate 2–4 sessions so the ask varies week to week
          type_target := 2 + mod(week_idx + program_idx, 3);
        elsif ch_type = 'precision' then
          type_target := 1;
        else  -- personal_best
          type_target := 1;
        end if;

        insert into weekly_challenges (week_key, program, challenge_type, target_reps, title, description, starts_at, ends_at, is_active)
        values (wk_key, prog, ch_type, type_target, ch_titles->>ch_type, ch_descs->>ch_type, wk_start, wk_end, true)
        on conflict (week_key, program, challenge_type) do nothing
        returning id into created_id;
      end;
    end loop;
  end loop;

  select coalesce(jsonb_agg(id), '[]'::jsonb) into existing_ids
  from weekly_challenges where week_key = wk_key;

  return existing_ids;
end;
$$;

grant execute on function ensure_weekly_challenge(timestamptz) to authenticated, anon;

-- ── 2. Monthly leaderboard ──
-- Points per entry (computed from stored total_reps vs the challenge target —
-- works retroactively, no new columns):
--   target met     → 100 pts + up to +50 bonus (proportional overage, 2× = max)
--   target not met → floor(progress %) → effort still counts (0–99 pts)
-- A challenge counts toward the calendar month containing its starts_at
-- (a week straddling a month boundary is attributed to the start month).

create or replace function get_monthly_challenge_leaderboard(
  p_month date default null,
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  m_start date := date_trunc('month', coalesce(p_month, current_date))::date;
  result jsonb;
begin
  with scored as (
    select
      e.user_id,
      e.display_name,
      e.updated_at,
      case
        when c.target_reps <= 0 then 0
        when e.total_reps >= c.target_reps
          then 100 + least(50, floor((e.total_reps::numeric / c.target_reps - 1) * 50))::int
        else floor(e.total_reps * 100.0 / c.target_reps)::int
      end as pts,
      (e.total_reps >= c.target_reps) as completed
    from weekly_challenge_entries e
    join weekly_challenges c on c.id = e.challenge_id
    where c.starts_at >= m_start
      and c.starts_at < (m_start + interval '1 month')
  ),
  agg as (
    select
      user_id,
      sum(pts) as points,
      count(*) filter (where completed) as completed_count,
      (array_agg(display_name order by updated_at desc))[1] as display_name
    from scored
    group by user_id
  ),
  ranked as (
    select
      user_id,
      points,
      completed_count,
      display_name,
      rank() over (order by points desc, completed_count desc) as rnk
    from agg
  )
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'user_id', user_id,
      'display_name', display_name,
      'points', points,
      'completed', completed_count,
      'rank', rnk
    ) order by rnk
  ), '[]'::jsonb) into result
  from (select * from ranked where rnk <= p_limit) t;

  return result;
end;
$$;

grant execute on function get_monthly_challenge_leaderboard(date, int) to authenticated, anon;
