-- 062_challenge_types.sql
-- Redesign weekly challenges: multiple challenge types per week, all tied
-- to the user's actual training (volume, consistency, precision, personal best).
-- Progress is auto-calculated client-side from session data and submitted
-- to the server for leaderboard ranking.

-- Add challenge_type column
alter table weekly_challenges
  add column if not exists challenge_type text not null default 'volume'
  check (challenge_type in ('volume', 'consistency', 'precision', 'personal_best'));

-- Drop the old week_key unique constraint — we now allow multiple challenges
-- per week (different programs × types). The new unique index below replaces it.
alter table weekly_challenges
  drop constraint if exists weekly_challenges_week_key_key;

-- target_reps is reused as the target for any type:
--   volume: target total reps
--   consistency: target number of sessions
--   precision: target 1 (achieve one all-pass session)
--   personal_best: target reps to beat (previous max)

-- Unique constraint: one challenge per (week_key, program, challenge_type)
create unique index if not exists weekly_challenges_week_program_type_idx
  on weekly_challenges(week_key, program, challenge_type);

-- ── RPC: get all active challenges for the current week ──
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
        when 'consistency' then 2
        when 'precision' then 3
        when 'personal_best' then 4
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

-- ── RPC: submit progress for a challenge (upsert — best wins) ──
-- Replaces submit_weekly_challenge_entry — works with any challenge type.
-- The progress_value is the client-calculated metric (reps, sessions, etc.).
create or replace function submit_challenge_progress(
  p_challenge_id uuid,
  p_progress_value int,
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
  if p_progress_value is null or p_progress_value < 0 then
    raise exception 'invalid_reps';
  end if;
  if char_length(p_display_name) > 60 then
    raise exception 'display_name_too_long';
  end if;

  select * into ch from weekly_challenges where id = p_challenge_id;
  if not found or not ch.is_active or now() < ch.starts_at or now() >= ch.ends_at then
    raise exception 'challenge_not_active';
  end if;

  select * into existing_entry
  from weekly_challenge_entries
  where challenge_id = p_challenge_id and user_id = uid;

  if found then
    if p_progress_value > existing_entry.total_reps then
      update weekly_challenge_entries
      set total_reps = p_progress_value, display_name = p_display_name, updated_at = now()
      where id = existing_entry.id
      returning * into new_entry;
    else
      new_entry := existing_entry;
    end if;
  else
    insert into weekly_challenge_entries (challenge_id, user_id, total_reps, display_name)
    values (p_challenge_id, uid, p_progress_value, p_display_name)
    returning * into new_entry;
  end if;

  return jsonb_build_object(
    'id', new_entry.id,
    'challenge_id', new_entry.challenge_id,
    'total_reps', new_entry.total_reps,
    'display_name', new_entry.display_name,
    'created_at', new_entry.created_at,
    'updated_at', new_entry.updated_at,
    'is_new_best', found and p_progress_value > existing_entry.total_reps
  );
end;
$$;

-- Grant execute
grant execute on function get_active_weekly_challenges() to authenticated, anon;
grant execute on function submit_challenge_progress(uuid, int, text) to authenticated, anon;

-- ── Update ensure_weekly_challenge to create multiple challenge types ──
-- Must drop first because return type changes from uuid to jsonb
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
  challenge_title text;
  challenge_desc text;
  week_num int;
  program_idx int;
  programs text[] := array['pushups', 'pullups', 'squats'];
  targets int[] := array[100, 50, 120];
  ch_type text;
  ch_types text[] := array['volume', 'consistency', 'precision', 'personal_best'];
  ch_titles jsonb;
  ch_descs jsonb;
  type_idx int;
  created_id uuid;
begin
  wk_key := weekly_challenge_week_key(for_date);
  wk_start := weekly_challenge_week_start(for_date);
  wk_end := wk_start + interval '7 days';

  -- Check if any challenges exist for this week
  select coalesce(jsonb_agg(id), '[]'::jsonb) into existing_ids
  from weekly_challenges where week_key = wk_key;

  -- Create challenges for each program × type combination
  for program_idx in 1..3 loop
    prog := programs[program_idx];
    target_reps := targets[program_idx];

    -- Challenge titles/descriptions per program
    if prog = 'pushups' then
      ch_titles := jsonb_build_object(
        'volume', 'Mistrz Pompek',
        'consistency', 'Dyscyplina Pompek',
        'precision', 'Perfekcyjne Pompki',
        'personal_best', 'Rekord Pompek'
      );
      ch_descs := jsonb_build_object(
        'volume', 'Zrób jak najwięcej pompek w tym tygodniu!',
        'consistency', 'Ukończ wszystkie zaplanowane treningi pompek!',
        'precision', 'Ukończ trening pompek ze wszystkimi seriami powyżej celu!',
        'personal_best', 'Pobij swój rekord w teście max pompek!'
      );
    elsif prog = 'pullups' then
      ch_titles := jsonb_build_object(
        'volume', 'Mistrz Podciągania',
        'consistency', 'Dyscyplina Podciągania',
        'precision', 'Perfekcyjne Podciąganie',
        'personal_best', 'Rekord Podciągania'
      );
      ch_descs := jsonb_build_object(
        'volume', 'Zrób jak najwięcej podciągnięć w tym tygodniu!',
        'consistency', 'Ukończ wszystkie zaplanowane treningi podciągania!',
        'precision', 'Ukończ trening podciągania ze wszystkimi seriami powyżej celu!',
        'personal_best', 'Pobij swój rekord w teście max podciągania!'
      );
    else
      ch_titles := jsonb_build_object(
        'volume', 'Mistrz Przysiadów',
        'consistency', 'Dyscyplina Przysiadów',
        'precision', 'Perfekcyjne Przysiady',
        'personal_best', 'Rekord Przysiadów'
      );
      ch_descs := jsonb_build_object(
        'volume', 'Zrób jak najwięcej przysiadów w tym tygodniu!',
        'consistency', 'Ukończ wszystkie zaplanowane treningi przysiadów!',
        'precision', 'Ukończ trening przysiadów ze wszystkimi seriami powyżej celu!',
        'personal_best', 'Pobij swój rekord w teście max przysiadów!'
      );
    end if;

    for type_idx in 1..4 loop
      ch_type := ch_types[type_idx];

      -- Skip if already exists (use table alias to avoid ambiguity)
      perform 1 from weekly_challenges wc
      where wc.week_key = wk_key and wc.program = prog and wc.challenge_type = ch_type;
      if found then continue; end if;

      -- Determine target per type
      declare
        type_target int;
      begin
        if ch_type = 'volume' then
          type_target := target_reps;
        elsif ch_type = 'consistency' then
          type_target := 3;  -- 3 sessions per week target
        elsif ch_type = 'precision' then
          type_target := 1;  -- 1 perfect session
        else  -- personal_best
          type_target := 1;  -- beat by at least 1
        end if;

        insert into weekly_challenges (week_key, program, challenge_type, target_reps, title, description, starts_at, ends_at, is_active)
        values (wk_key, prog, ch_type, type_target, ch_titles->>ch_type, ch_descs->>ch_type, wk_start, wk_end, true)
        on conflict (week_key, program, challenge_type) do nothing
        returning id into created_id;
      end;
    end loop;
  end loop;

  -- Return all challenge IDs for this week
  select coalesce(jsonb_agg(id), '[]'::jsonb) into existing_ids
  from weekly_challenges where week_key = wk_key;

  return existing_ids;
end;
$$;

-- Re-grant (function was redefined)
grant execute on function ensure_weekly_challenge(timestamptz) to authenticated, anon;
