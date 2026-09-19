-- 094_challenge_pool_expansion.sql
-- Weekly challenges v4: large pools + permutation draw for rare repeats.
--
-- Pool grows from 14 to 34 types across the same 4 categories. The weekly
-- draw stays deterministic (one type per category × 3 programs), but the
-- index is a coprime-step permutation over the pool: every type appears
-- EXACTLY ONCE per pool-size cycle before repeating — the minimum possible
-- repeat interval (power 9 wk, habit 12 wk, skill 7 wk, records 6 wk),
-- which a random draw cannot guarantee. Targets still breathe 80–120%
-- week over week, so even a repeated type asks for something different.
--
-- New types (client-computed from real sessions, anti-cheat):
--   surplus        bonus reps above set targets              (target: reps)
--   dominator      >=1 set at >=150% of target               (target: 1)
--   strong_finish  >=1 session whose last set passed         (target: 1)
--   session_starter>=1 session whose first set passed        (target: 1)
--   big_day        best single-DAY rep total                 (target: reps)
--   weekday_quest  >=1 session on the drawn ISO weekday      (target: 1;
--                  day = 1 + mod(week_idx * 3, 7), derived from starts_at
--                  so the client computes the same day — no extra column)
--   morning_moves  >=1 session before 12:00                  (target: 1)
--   lunch_break    >=1 session starting 11:00–14:00          (target: 1)
--   evening_shift  >=1 session starting 18:00–22:00          (target: 1)
--   around_the_clock session <9:00 AND session >=20:00       (target: 2)
--   sunday_sweat   >=1 session on Sunday                     (target: 1)
--   hat_trick      3 sessions with all sets passed           (target: 3)
--   flawless_sets  N sets at/above their target              (target: sets)
--   sharpshooter   >=1 set landing EXACTLY on target         (target: 1)
--   bounce_back    >=1 session with a failed set later passed(target: 1)
--   metronome      >=1 session of >=3 sets, max-min <=2 reps (target: 1)
--   volume_record  week total minus best-ever week total     (target: 1)
--   session_record best session minus best-ever session      (target: 1)
--   day_record     best day minus best-ever day              (target: 1)
--   beat_average   week total minus 4-week average           (target: 1)

-- ── 1. Extend allowed challenge types ──
alter table weekly_challenges
  drop constraint if exists weekly_challenges_challenge_type_check;
alter table weekly_challenges
  add constraint weekly_challenges_challenge_type_check
  check (challenge_type in (
    'volume', 'marathon', 'max_set', 'grinder', 'surplus', 'dominator',
    'strong_finish', 'session_starter', 'big_day',
    'consistency', 'daily', 'early_bird', 'night_owl', 'weekend', 'double',
    'weekday_quest', 'morning_moves', 'lunch_break', 'evening_shift',
    'around_the_clock', 'sunday_sweat',
    'precision', 'perfect_pair', 'hat_trick', 'flawless_sets',
    'sharpshooter', 'bounce_back', 'metronome',
    'personal_best', 'improvement', 'volume_record', 'session_record',
    'day_record', 'beat_average'
  ));

-- ── 2. Ordering — grouped by category ──
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
        when 'surplus' then 5
        when 'dominator' then 6
        when 'strong_finish' then 7
        when 'session_starter' then 8
        when 'big_day' then 9
        when 'consistency' then 10
        when 'daily' then 11
        when 'early_bird' then 12
        when 'night_owl' then 13
        when 'weekend' then 14
        when 'double' then 15
        when 'weekday_quest' then 16
        when 'morning_moves' then 17
        when 'lunch_break' then 18
        when 'evening_shift' then 19
        when 'around_the_clock' then 20
        when 'sunday_sweat' then 21
        when 'precision' then 22
        when 'perfect_pair' then 23
        when 'hat_trick' then 24
        when 'flawless_sets' then 25
        when 'sharpshooter' then 26
        when 'bounce_back' then 27
        when 'metronome' then 28
        when 'personal_best' then 29
        when 'improvement' then 30
        when 'volume_record' then 31
        when 'session_record' then 32
        when 'day_record' then 33
        when 'beat_average' then 34
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

-- ── 3. ensure_weekly_challenge — permutation draw over big pools ──
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
  prog_label text;
  ch_type text;
  type_titles jsonb;
  type_descs jsonb;
  type_idx int;
  program_idx int;
  created_id uuid;
  week_idx int;
  sel_types text[];
  vol_scale numeric;
  programs text[] := array['pushups', 'pullups', 'squats'];
  prog_labels text[] := array['Pompki', 'Podciągania', 'Przysiadów'];
  targets int[] := array[100, 50, 120];
  -- Per-program base targets for rep/set-based types.
  marathon_targets int[] := array[45, 20, 60];
  max_set_targets int[] := array[25, 10, 35];
  grinder_targets int[] := array[25, 15, 30];
  improvement_targets int[] := array[20, 10, 25];
  surplus_targets int[] := array[15, 8, 20];
  big_day_targets int[] := array[40, 20, 50];
  flawless_sets_targets int[] := array[10, 6, 12];
  -- Category pools (order = permutation source).
  power_types text[] := array[
    'volume', 'marathon', 'max_set', 'grinder', 'surplus',
    'dominator', 'strong_finish', 'session_starter', 'big_day'
  ];
  habit_types text[] := array[
    'consistency', 'daily', 'early_bird', 'night_owl', 'weekend', 'double',
    'weekday_quest', 'morning_moves', 'lunch_break', 'evening_shift',
    'around_the_clock', 'sunday_sweat'
  ];
  skill_types text[] := array[
    'precision', 'perfect_pair', 'hat_trick', 'flawless_sets',
    'sharpshooter', 'bounce_back', 'metronome'
  ];
  records_types text[] := array[
    'personal_best', 'improvement', 'volume_record', 'session_record',
    'day_record', 'beat_average'
  ];
begin
  wk_key := weekly_challenge_week_key(for_date);
  wk_start := weekly_challenge_week_start(for_date);
  wk_end := wk_start + interval '7 days';

  -- Absolute week index — continuous across year boundaries.
  week_idx := floor(extract(epoch from wk_start) / 604800)::int;

  -- Permutation draw: coprime step × week index walks the whole pool before
  -- repeating → same-type interval equals the pool size (9/12/7/6 weeks).
  sel_types := array[
    power_types[1 + mod(week_idx * 5 + 2, 9)],
    habit_types[1 + mod(week_idx * 7 + 1, 12)],
    skill_types[1 + mod(week_idx * 3 + 4, 7)],
    records_types[1 + mod(week_idx * 5 + 3, 6)]
  ];
  -- Rep/set targets breathe 80% → 100% → 120% across weeks.
  vol_scale := 0.8 + 0.2 * mod(week_idx, 3);

  -- Generic per-type copy stored as row metadata — the client renders
  -- localized titles/descriptions keyed by challenge_type, so these are
  -- only fallbacks/debug info.
  type_titles := jsonb_build_object(
    'volume', 'Mistrz Objętości', 'marathon', 'Maraton', 'max_set', 'Seria Mocy',
    'grinder', 'Młynarz', 'surplus', 'Premia za Więcej', 'dominator', 'Dominator',
    'strong_finish', 'Mocny Finał', 'session_starter', 'Mocny Start', 'big_day', 'Wielki Dzień',
    'consistency', 'Żelazna Dyscyplina', 'daily', 'Codzienny Rytm',
    'early_bird', 'Skowronek', 'night_owl', 'Nocna Sowa', 'weekend', 'Wojownik Weekendu',
    'double', 'Dublet', 'weekday_quest', 'Misja Dnia', 'morning_moves', 'Poranna Rozgrzewka',
    'lunch_break', 'Przerwa na Trening', 'evening_shift', 'Wieczorna Zmiana',
    'around_the_clock', 'Do Okoła Zegara', 'sunday_sweat', 'Niedzielny Pot',
    'precision', 'Perfekcyjna Forma', 'perfect_pair', 'Para Perfekcyjna',
    'hat_trick', 'Hat-Trick', 'flawless_sets', 'Bez Skazy', 'sharpshooter', 'Snajper',
    'bounce_back', 'Powrót po Upadku', 'metronome', 'Metronom',
    'personal_best', 'Łowca Rekordów', 'improvement', 'Skok Progresu',
    'volume_record', 'Rekord Tygodnia', 'session_record', 'Rekord Treningu',
    'day_record', 'Rekord Dnia', 'beat_average', 'Ponad Średnią'
  );
  type_descs := jsonb_build_object(
    'volume', 'Zrób jak najwięcej powtórzeń w tym tygodniu!',
    'marathon', 'Zrób jak najwięcej powtórzeń w jednym treningu!',
    'max_set', 'Zrób jak najwięcej powtórzeń w jednej serii!',
    'grinder', 'Ukończ jak najwięcej serii!',
    'surplus', 'Zrób powtórzenia ponad cel serii!',
    'dominator', 'Zrób serię na co najmniej 150% celu!',
    'strong_finish', 'Zakończ trening zaliczoną ostatnią serią!',
    'session_starter', 'Zacznij trening zaliczoną pierwszą serią!',
    'big_day', 'Zrób jak najwięcej powtórzeń w jednym dniu!',
    'consistency', 'Ukończ wymaganą liczbę treningów!',
    'daily', 'Trenuj w jak największej liczbie dni!',
    'early_bird', 'Ukończ trening rozpoczęty przed 9:00!',
    'night_owl', 'Ukończ trening rozpoczęty po 20:00!',
    'weekend', 'Ukończ trening w sobotę lub niedzielę!',
    'double', 'Ukończ dwa treningi tego samego dnia!',
    'weekday_quest', 'Ukończ trening we wylosowany dzień tygodnia!',
    'morning_moves', 'Ukończ trening rozpoczęty przed 12:00!',
    'lunch_break', 'Ukończ trening rozpoczęty między 11:00 a 14:00!',
    'evening_shift', 'Ukończ trening rozpoczęty między 18:00 a 22:00!',
    'around_the_clock', 'Ukończ trening przed 9:00 i trening po 20:00!',
    'sunday_sweat', 'Ukończ trening w niedzielę!',
    'precision', 'Ukończ trening ze wszystkimi seriami powyżej celu!',
    'perfect_pair', 'Ukończ dwa treningi ze wszystkimi seriami powyżej celu!',
    'hat_trick', 'Ukończ trzy treningi ze wszystkimi seriami powyżej celu!',
    'flawless_sets', 'Zrób serie na poziomie celu lub wyżej!',
    'sharpshooter', 'Zrób serię dokładnie na cel!',
    'bounce_back', 'Po niezaliczonej serii zalicz kolejną!',
    'metronome', 'Zrób trening z seriami o równej liczbie powtórzeń!',
    'personal_best', 'Pobij swój rekord w teście max!',
    'improvement', 'Zrób więcej powtórzeń niż w zeszłym tygodniu!',
    'volume_record', 'Pobij swój rekord powtórzeń w tygodniu!',
    'session_record', 'Pobij swój rekord powtórzeń w jednym treningu!',
    'day_record', 'Pobij swój rekord powtórzeń w jednym dniu!',
    'beat_average', 'Zrób więcej powtórzeń niż Twoja średnia tygodniowa!'
  );

  for program_idx in 1..3 loop
    prog := programs[program_idx];
    prog_label := prog_labels[program_idx];

    for type_idx in 1..4 loop
      ch_type := sel_types[type_idx];

      perform 1 from weekly_challenges wc
      where wc.week_key = wk_key and wc.program = prog and wc.challenge_type = ch_type;
      if found then continue; end if;

      declare
        type_target int;
      begin
        if ch_type = 'volume' then
          type_target := (round(targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'marathon' then
          type_target := (round(marathon_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'max_set' then
          type_target := (round(max_set_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'grinder' then
          type_target := (round(grinder_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'surplus' then
          type_target := (round(surplus_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'big_day' then
          type_target := (round(big_day_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'flawless_sets' then
          type_target := (round(flawless_sets_targets[program_idx] * vol_scale / 5) * 5)::int;
        elsif ch_type = 'improvement' then
          -- Flat rep delta over last week — no scaling.
          type_target := improvement_targets[program_idx];
        elsif ch_type = 'consistency' then
          type_target := 2 + mod(week_idx + program_idx, 3);   -- 2–4 sessions
        elsif ch_type = 'daily' then
          type_target := 3 + mod(week_idx + program_idx, 2);   -- 3–4 days
        elsif ch_type = 'perfect_pair' then
          type_target := 2;
        elsif ch_type = 'hat_trick' then
          type_target := 3;
        elsif ch_type = 'around_the_clock' then
          type_target := 2;   -- one early + one late session
        else
          -- precision, personal_best, records deltas, all binary habit/skill types
          type_target := 1;
        end if;

        insert into weekly_challenges (week_key, program, challenge_type, target_reps, title, description, starts_at, ends_at, is_active)
        values (
          wk_key, prog, ch_type, type_target,
          (type_titles->>ch_type) || ' — ' || prog_label,
          type_descs->>ch_type,
          wk_start, wk_end, true
        )
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
