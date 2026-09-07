-- ═══════════════════════════════════════════════════════════════
-- 049: Fix refresh_my_public_profile_stats authentication check
--
-- Problem: The function used follow_assert_authenticated() as a default
-- value in the DECLARE section (uid uuid := follow_assert_authenticated()).
-- In nested SECURITY DEFINER contexts, auth.uid() may not be available
-- at variable initialization time, causing a 400 Bad Request even when
-- the user has a valid session.
--
-- Fix: Move the auth check into the function body using auth.uid() directly.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.refresh_my_public_profile_stats()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  total_sessions int;
  total_reps int;
  current_streak int;
  best_streak int;
  pushup_max int;
  pullup_max int;
  profile_row public_profiles%rowtype;
begin
  -- Check authentication directly — don't rely on follow_assert_authenticated()
  -- which can fail in nested SECURITY DEFINER contexts.
  uid := auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Only update if a profile row already exists (user must opt in to public profile first)
  if not exists (select 1 from public_profiles where user_id = uid) then
    return jsonb_build_object(
      'total_sessions', 0, 'total_reps', 0,
      'current_streak_weeks', 0, 'best_streak_weeks', 0,
      'pushup_max', 0, 'pullup_max', 0
    );
  end if;

  -- Total completed sessions + total reps
  select count(*), coalesce(sum(total_reps), 0)
  into total_sessions, total_reps
  from workout_sessions
  where user_id = uid and status = 'completed';

  -- Pushup max test
  select coalesce(max(reps), 0) into pushup_max
  from max_tests where user_id = uid and program = 'pushups';

  -- Pullup max test
  select coalesce(max(reps), 0) into pullup_max
  from max_tests where user_id = uid and program = 'pullups';

  -- Current streak
  with weekly as (
    select
      date_trunc('week', completed_at) as week_start,
      count(*) as sessions
    from workout_sessions
    where user_id = uid and status = 'completed' and completed_at is not null
    group by 1
  ),
  streak_calc as (
    select count(*) as streak
    from (
      select week_start,
        week_start - (row_number() over (order by week_start) * interval '1 week') as grp
      from weekly
      where sessions > 0
    ) t
    where week_start >= date_trunc('week', now()) - interval '1 week'
    group by grp
    order by count(*) desc
    limit 1
  )
  select coalesce(max(streak), 0) into current_streak from streak_calc;

  -- Best streak (all-time)
  with weekly as (
    select
      date_trunc('week', completed_at) as week_start,
      count(*) as sessions
    from workout_sessions
    where user_id = uid and status = 'completed' and completed_at is not null
    group by 1
  ),
  streak_calc as (
    select count(*) as streak
    from (
      select week_start,
        week_start - (row_number() over (order by week_start) * interval '1 week') as grp
      from weekly
      where sessions > 0
    ) t
    group by grp
  )
  select coalesce(max(streak), 0) into best_streak from streak_calc;

  -- Update existing row only
  update public_profiles set
    total_sessions = total_sessions,
    total_reps = total_reps,
    current_streak_weeks = current_streak,
    best_streak_weeks = best_streak,
    pushup_max = pushup_max,
    pullup_max = pullup_max,
    updated_at = now()
  where user_id = uid
  returning * into profile_row;

  return jsonb_build_object(
    'total_sessions', profile_row.total_sessions,
    'total_reps', profile_row.total_reps,
    'current_streak_weeks', profile_row.current_streak_weeks,
    'best_streak_weeks', profile_row.best_streak_weeks,
    'pushup_max', profile_row.pushup_max,
    'pullup_max', profile_row.pullup_max
  );
end;
$$;

grant execute on function public.refresh_my_public_profile_stats() to authenticated;
