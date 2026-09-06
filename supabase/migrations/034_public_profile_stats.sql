-- 034_public_profile_stats.sql
-- Auto-populate public_profiles stats from workout_sessions + max_tests.
-- RPC: refresh_my_public_profile_stats — computes stats and updates public_profiles row.

create or replace function refresh_my_public_profile_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := follow_assert_authenticated();
  total_sessions int;
  total_reps int;
  current_streak int;
  best_streak int;
  pushup_max int;
  pullup_max int;
  profile_row public_profiles%rowtype;
begin
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

  -- Streak: count consecutive weeks with at least 1 completed session, ending current or last week
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

  -- Upsert public profile with stats
  insert into public_profiles (
    user_id, display_name, bio, is_public,
    total_sessions, total_reps, current_streak_weeks, best_streak_weeks,
    pushup_max, pullup_max, updated_at
  )
  values (
    uid, '', '', false,
    total_sessions, total_reps, current_streak, best_streak,
    pushup_max, pullup_max, now()
  )
  on conflict (user_id)
  do update set
    total_sessions = excluded.total_sessions,
    total_reps = excluded.total_reps,
    current_streak_weeks = excluded.current_streak_weeks,
    best_streak_weeks = excluded.best_streak_weeks,
    pushup_max = excluded.pushup_max,
    pullup_max = excluded.pullup_max,
    updated_at = now()
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
