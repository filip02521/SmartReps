-- ═══════════════════════════════════════════════════════════════
-- 047: Fix follow display name fallback + refresh stats insert bug
--
-- Bug 1: get_followers / get_following showed "Anonim" for users
--   who have community_publications.author_display_name but no
--   public_profiles row. The LEFT JOIN on public_profiles returned
--   NULL display_name, and the frontend showed "Anonim".
--   Fix: fall back to community_publications.author_display_name
--   when public_profiles.display_name is NULL or empty.
--
-- Bug 2: refresh_my_public_profile_stats INSERTED a new row with
--   display_name='' and is_public=false for every user who loaded
--   the profile page, even if they never opted in to a public profile.
--   This created empty profile rows that overwrote real data on
--   subsequent calls and caused users to appear as "Anonim".
--   Fix: only UPDATE existing rows. If no row exists, return zeros
--   without creating one. Users must call upsert_my_public_profile
--   first to opt in.
-- ═══════════════════════════════════════════════════════════════

-- ── Fix 1a: get_followers — fall back to community_publications.author_display_name ──
create or replace function get_followers(
  p_limit int default 50
)
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
      'follower_id', sub.follower_id,
      'display_name', coalesce(nullif(sub.display_name, ''), sub.community_name, ''),
      'bio', coalesce(sub.bio, ''),
      'total_sessions', coalesce(sub.total_sessions, 0),
      'total_reps', coalesce(sub.total_reps, 0),
      'current_streak_weeks', coalesce(sub.current_streak_weeks, 0),
      'best_streak_weeks', coalesce(sub.best_streak_weeks, 0),
      'pushup_max', coalesce(sub.pushup_max, 0),
      'pullup_max', coalesce(sub.pullup_max, 0),
      'followed_at', sub.followed_at
    )
    order by sub.followed_at desc
  ), '[]'::jsonb) into result
  from (
    select
      f.follower_id,
      p.display_name,
      p.bio,
      p.total_sessions,
      p.total_reps,
      p.current_streak_weeks,
      p.best_streak_weeks,
      p.pushup_max,
      p.pullup_max,
      f.created_at as followed_at,
      (select cp.author_display_name from community_publications cp
       where cp.author_id = f.follower_id
         and cp.author_display_name is not null
         and cp.author_display_name <> ''
       limit 1) as community_name
    from user_follows f
    left join public_profiles p on p.user_id = f.follower_id
    where f.followee_id = follow_assert_authenticated()
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

revoke execute on function get_followers(int) from public;
revoke execute on function get_followers(int) from anon;
grant execute on function get_followers(int) to authenticated;

-- ── Fix 1b: get_following — same fallback ──
create or replace function get_following(
  p_limit int default 50
)
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
      'followee_id', sub.followee_id,
      'followed_at', sub.followed_at,
      'display_name', coalesce(nullif(sub.display_name, ''), sub.community_name, ''),
      'bio', coalesce(sub.bio, ''),
      'total_sessions', coalesce(sub.total_sessions, 0),
      'total_reps', coalesce(sub.total_reps, 0),
      'current_streak_weeks', coalesce(sub.current_streak_weeks, 0),
      'best_streak_weeks', coalesce(sub.best_streak_weeks, 0),
      'pushup_max', coalesce(sub.pushup_max, 0),
      'pullup_max', coalesce(sub.pullup_max, 0)
    )
    order by sub.followed_at desc
  ), '[]'::jsonb) into result
  from (
    select f.followee_id, f.created_at as followed_at,
           p.display_name, p.bio,
           p.total_sessions, p.total_reps,
           p.current_streak_weeks, p.best_streak_weeks,
           p.pushup_max, p.pullup_max,
           (select cp.author_display_name from community_publications cp
            where cp.author_id = f.followee_id
              and cp.author_display_name is not null
              and cp.author_display_name <> ''
            limit 1) as community_name
    from user_follows f
    left join public_profiles p on p.user_id = f.followee_id
    where f.follower_id = follow_assert_authenticated()
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

revoke execute on function get_following(int) from public;
revoke execute on function get_following(int) from anon;
grant execute on function get_following(int) to authenticated;

-- ── Fix 2: refresh_my_public_profile_stats — only UPDATE, don't INSERT empty rows ──
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
  -- Only update if a profile row already exists
  -- (user must opt in to public profile via upsert_my_public_profile first)
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

  -- Update existing row only — do NOT insert
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

-- Re-grant (signature unchanged)
revoke execute on function refresh_my_public_profile_stats() from public;
revoke execute on function refresh_my_public_profile_stats() from anon;
grant execute on function refresh_my_public_profile_stats() to authenticated;
