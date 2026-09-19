-- 093_challenge_categories.sql
-- Weekly challenges v3: categories + weekly draw.
--
-- Challenges are grouped into 4 categories; every ISO week deterministically
-- draws ONE type from each category (× 3 programs = 12 challenges). The draw
-- is derived from the absolute week index, so every client generates the
-- identical set — leaderboards stay global — while the specific tasks rotate
-- inside each category week over week.
--
-- Categories:
--   power   (Siła)      volume, marathon, max_set, grinder
--   habit   (Rytm)      consistency, daily, early_bird, night_owl, weekend, double
--   skill   (Precyzja)  precision, perfect_pair
--   records (Rekordy)   personal_best, improvement
--
-- Progress semantics (computed client-side from real sessions, anti-cheat):
--   marathon      best single-session rep total          (target: reps)
--   max_set       best single set                        (target: reps)
--   grinder       total completed sets                   (target: sets)
--   daily         sessions on N distinct days            (target: days)
--   early_bird    >=1 session starting before 9:00       (target: 1)
--   night_owl     >=1 session starting at/after 20:00    (target: 1)
--   weekend       >=1 session on Sat/Sun                 (target: 1)
--   double        >=1 day with 2 sessions                (target: 1)
--   perfect_pair  N sessions with all sets passed        (target: 2)
--   improvement   this-week total reps - last-week total (target: rep delta;
--                 no baseline week → progress 0, same as personal_best)

-- ── 1. Extend the allowed challenge types ──
alter table weekly_challenges
  drop constraint if exists weekly_challenges_challenge_type_check;
alter table weekly_challenges
  add constraint weekly_challenges_challenge_type_check
  check (challenge_type in (
    'volume', 'marathon', 'max_set', 'grinder',
    'consistency', 'daily', 'early_bird', 'night_owl', 'weekend', 'double',
    'precision', 'perfect_pair',
    'personal_best', 'improvement'
  ));

-- ── 2. Category-aware ordering in get_active_weekly_challenges ──
create or replace function get_active_weekly_challenges()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'week_key', c.week_key,
      'program', c.program,
      'challenge_type', c.challenge_type,
      'target_reps', c.target_reps,
      'title', c.title,
      'description', c.description,
      'starts_at', c.starts_at,
      'ends_at', c.ends_at
    )
    order by
      case c.challenge_type
        when 'volume' then 1
        when 'marathon' then 2
        when 'max_set' then 3
        when 'grinder' then 4
        when 'consistency' then 5
        when 'daily' then 6
        when 'early_bird' then 7
        when 'night_owl' then 8
        when 'weekend' then 9
        when 'double' then 10
        when 'precision' then 11
        when 'perfect_pair' then 12
        when 'personal_best' then 13
        when 'improvement' then 14
        else 99
      end,
      c.program
  ), '[]'::jsonb) into result
  from weekly_challenges c
  where c.is_active = true
    and c.starts_at <= now()
    and c.ends_at > now();

  return result;
end;
$$;

grant execute on function get_active_weekly_challenges() to authenticated, anon;

-- ── 3. ensure_weekly_challenge — one drawn type per category ──
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
  -- Per-program base targets for the new rep/set-based types.
  marathon_targets int[] := array[45, 20, 60];
  max_set_targets int[] := array[25, 10, 35];
  grinder_targets int[] := array[25, 15, 30];
  improvement_targets int[] := array[20, 10, 25];
  -- Category pools. Steps are coprime with pool length where >1 so the
  -- draw order permutes instead of advancing linearly.
  power_types text[] := array['volume', 'marathon', 'max_set', 'grinder'];
  habit_types text[] := array['consistency', 'daily', 'early_bird', 'night_owl', 'weekend', 'double'];
  skill_types text[] := array['precision', 'perfect_pair'];
  records_types text[] := array['personal_best', 'improvement'];
begin
  wk_key := weekly_challenge_week_key(for_date);
  wk_start := weekly_challenge_week_start(for_date);
  wk_end := wk_start + interval '7 days';

  -- Absolute week index — continuous across year boundaries.
  week_idx := floor(extract(epoch from wk_start) / 604800)::int;

  -- Weekly draw: exactly one type per category → 4 types × 3 programs.
  sel_types := array[
    power_types[1 + mod(week_idx * 3, 4)],
    habit_types[1 + mod(week_idx * 5 + 1, 6)],
    skill_types[1 + mod(week_idx + 1, 2)],
    records_types[1 + mod(week_idx, 2)]
  ];
  -- Rep/set targets breathe 80% → 100% → 120% across weeks.
  vol_scale := 0.8 + 0.2 * mod(week_idx, 3);

  for program_idx in 1..3 loop
    prog := programs[program_idx];
    target_reps := targets[program_idx];

    -- Titles/descriptions stored in the row are metadata — the client
    -- renders localized copy keyed by challenge_type.
    if prog = 'pushups' then
      ch_titles := jsonb_build_object(
        'volume', 'Mistrz Pompek', 'marathon', 'Maraton Pompek', 'max_set', 'Seria Mocy — Pompki',
        'grinder', 'Młynarz Pompek', 'consistency', 'Dyscyplina Pompek', 'daily', 'Co Dzień Pompki',
        'early_bird', 'Skowronek Pompek', 'night_owl', 'Sowa Pompek', 'weekend', 'Weekendowe Pompki',
        'double', 'Dublet Pompek', 'precision', 'Perfekcyjne Pompki', 'perfect_pair', 'Para Perfekcyjnych Pompek',
        'personal_best', 'Rekord Pompek', 'improvement', 'Progres Pompek'
      );
      ch_descs := jsonb_build_object(
        'volume', 'Zrób jak najwięcej pompek w tym tygodniu!',
        'marathon', 'Zrób jak najwięcej pompek w jednym treningu!',
        'max_set', 'Zrób jak najwięcej pompek w jednej serii!',
        'grinder', 'Ukończ jak najwięcej serii pompek!',
        'consistency', 'Ukończ wymaganą liczbę treningów pompek!',
        'daily', 'Trenuj pompki w jak największej liczbie dni!',
        'early_bird', 'Ukończ trening pompek przed 9:00!',
        'night_owl', 'Ukończ trening pompek po 20:00!',
        'weekend', 'Ukończ trening pompek w sobotę lub niedzielę!',
        'double', 'Ukończ dwa treningi pompek tego samego dnia!',
        'precision', 'Ukończ trening pompek ze wszystkimi seriami powyżej celu!',
        'perfect_pair', 'Ukończ dwa treningi pompek ze wszystkimi seriami powyżej celu!',
        'personal_best', 'Pobij swój rekord w teście max pompek!',
        'improvement', 'Zrób więcej pompek niż w zeszłym tygodniu!'
      );
    elsif prog = 'pullups' then
      ch_titles := jsonb_build_object(
        'volume', 'Mistrz Podciągania', 'marathon', 'Maraton Podciągania', 'max_set', 'Seria Mocy — Podciąganie',
        'grinder', 'Młynarz Podciągania', 'consistency', 'Dyscyplina Podciągania', 'daily', 'Co Dzień Podciąganie',
        'early_bird', 'Skowronek Podciągania', 'night_owl', 'Sowa Podciągania', 'weekend', 'Weekendowe Podciąganie',
        'double', 'Dublet Podciągania', 'precision', 'Perfekcyjne Podciąganie', 'perfect_pair', 'Para Perfekcyjnych Podciągnięć',
        'personal_best', 'Rekord Podciągania', 'improvement', 'Progres Podciągania'
      );
      ch_descs := jsonb_build_object(
        'volume', 'Zrób jak najwięcej podciągnięć w tym tygodniu!',
        'marathon', 'Zrób jak najwięcej podciągnięć w jednym treningu!',
        'max_set', 'Zrób jak najwięcej podciągnięć w jednej serii!',
        'grinder', 'Ukończ jak najwięcej serii podciągania!',
        'consistency', 'Ukończ wymaganą liczbę treningów podciągania!',
        'daily', 'Trenuj podciąganie w jak największej liczbie dni!',
        'early_bird', 'Ukończ trening podciągania przed 9:00!',
        'night_owl', 'Ukończ trening podciągania po 20:00!',
        'weekend', 'Ukończ trening podciągania w sobotę lub niedzielę!',
        'double', 'Ukończ dwa treningi podciągania tego samego dnia!',
        'precision', 'Ukończ trening podciągania ze wszystkimi seriami powyżej celu!',
        'perfect_pair', 'Ukończ dwa treningi podciągania ze wszystkimi seriami powyżej celu!',
        'personal_best', 'Pobij swój rekord w teście max podciągania!',
        'improvement', 'Zrób więcej podciągnięć niż w zeszłym tygodniu!'
      );
    else
      ch_titles := jsonb_build_object(
        'volume', 'Mistrz Przysiadów', 'marathon', 'Maraton Przysiadów', 'max_set', 'Seria Mocy — Przysiady',
        'grinder', 'Młynarz Przysiadów', 'consistency', 'Dyscyplina Przysiadów', 'daily', 'Co Dzień Przysiady',
        'early_bird', 'Skowronek Przysiadów', 'night_owl', 'Sowa Przysiadów', 'weekend', 'Weekendowe Przysiady',
        'double', 'Dublet Przysiadów', 'precision', 'Perfekcyjne Przysiady', 'perfect_pair', 'Para Perfekcyjnych Przysiadów',
        'personal_best', 'Rekord Przysiadów', 'improvement', 'Progres Przysiadów'
      );
      ch_descs := jsonb_build_object(
        'volume', 'Zrób jak najwięcej przysiadów w tym tygodniu!',
        'marathon', 'Zrób jak najwięcej przysiadów w jednym treningu!',
        'max_set', 'Zrób jak najwięcej przysiadów w jednej serii!',
        'grinder', 'Ukończ jak najwięcej serii przysiadów!',
        'consistency', 'Ukończ wymaganą liczbę treningów przysiadów!',
        'daily', 'Trenuj przysiady w jak największej liczbie dni!',
        'early_bird', 'Ukończ trening przysiadów przed 9:00!',
        'night_owl', 'Ukończ trening przysiadów po 20:00!',
        'weekend', 'Ukończ trening przysiadów w sobotę lub niedzielę!',
        'double', 'Ukończ dwa treningi przysiadów tego samego dnia!',
        'precision', 'Ukończ trening przysiadów ze wszystkimi seriami powyżej celu!',
        'perfect_pair', 'Ukończ dwa treningi przysiadów ze wszystkimi seriami powyżej celu!',
        'personal_best', 'Pobij swój rekord w teście max przysiadów!',
        'improvement', 'Zrób więcej przysiadów niż w zeszłym tygodniu!'
      );
    end if;

    for type_idx in 1..4 loop
      ch_type := sel_types[type_idx];

      perform 1 from weekly_challenges wc
      where wc.week_key = wk_key and wc.program = prog and wc.challenge_type = ch_type;
      if found then continue; end if;

      declare
        type_target int;
      begin
        if ch_type = 'volume' then
          type_target := (round(target_reps * vol_scale / 5) * 5)::int;
        elsif ch_type = 'marathon' then
          type_target := (round(marathon_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'max_set' then
          type_target := (round(max_set_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'grinder' then
          type_target := (round(grinder_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'improvement' then
          -- Flat rep delta over last week — no scaling, the ask is always
          -- "a bit more than before" and must stay modest to be reachable.
          type_target := improvement_targets[program_idx];
        elsif ch_type = 'consistency' then
          type_target := 2 + mod(week_idx + program_idx, 3);   -- 2–4 sessions
        elsif ch_type = 'daily' then
          type_target := 3 + mod(week_idx + program_idx, 2);   -- 3–4 days
        elsif ch_type = 'perfect_pair' then
          type_target := 2;
        else
          -- precision, personal_best, early_bird, night_owl, weekend, double
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
