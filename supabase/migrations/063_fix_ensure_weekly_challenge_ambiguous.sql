-- 063_fix_ensure_weekly_challenge_ambiguous.sql
-- Fix: column reference "program" was ambiguous in ensure_weekly_challenge
-- (PL/pgSQL variable vs table column). Renamed variable to `prog` and
-- added table alias `wc` in queries.
--
-- This fix is already included in 062 for fresh installs. This migration
-- exists because 062 was applied to production before the fix.

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
  ch_types text[] := array['volume', 'consistency', 'precision', 'personal_best'];
  ch_titles jsonb;
  ch_descs jsonb;
  type_idx int;
  created_id uuid;
  week_num int;
  program_idx int;
  programs text[] := array['pushups', 'pullups', 'squats'];
  targets int[] := array[100, 50, 120];
begin
  wk_key := weekly_challenge_week_key(for_date);
  wk_start := weekly_challenge_week_start(for_date);
  wk_end := wk_start + interval '7 days';

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

    for type_idx in 1..4 loop
      ch_type := ch_types[type_idx];

      perform 1 from weekly_challenges wc
      where wc.week_key = wk_key and wc.program = prog and wc.challenge_type = ch_type;
      if found then continue; end if;

      declare
        type_target int;
      begin
        if ch_type = 'volume' then
          type_target := target_reps;
        elsif ch_type = 'consistency' then
          type_target := 3;
        elsif ch_type = 'precision' then
          type_target := 1;
        else
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
