-- 036_fix_community_rpc_bugs.sql
-- Fixes critical bugs found in audit:
-- 1. jsonb_agg + LIMIT bug (leaderboard, following, followers)
-- 2. is_new_best NULL bug in submit_weekly_challenge_entry
-- 3. get_following missing is_public filter
-- 4. public_profiles UPDATE policy — restrict stats columns
-- 5. NULL guards in RPC functions
-- 6. REVOKE/GRANT for new RPCs and tables

-- ═══════════════════════════════════════════════════════════════
-- 1. Fix submit_weekly_challenge_entry — is_new_best + NULL guards
-- ═══════════════════════════════════════════════════════════════
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
  is_new_best boolean := false;
  had_existing boolean := false;
begin
  -- Validate inputs (NULL-safe)
  if p_total_reps is null or p_total_reps < 0 then
    raise exception 'invalid_reps';
  end if;
  if p_display_name is null then
    p_display_name := '';
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

  had_existing := found;

  if had_existing then
    if p_total_reps > existing_entry.total_reps then
      is_new_best := true;
      update weekly_challenge_entries
      set total_reps = p_total_reps, display_name = p_display_name, updated_at = now()
      where id = existing_entry.id
      returning * into new_entry;
    else
      new_entry := existing_entry;
    end if;
  else
    -- New entry — it's always a "best" since there was nothing before
    is_new_best := true;
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
    'is_new_best', is_new_best
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 2. Fix get_weekly_challenge_leaderboard — subquery LIMIT
-- ═══════════════════════════════════════════════════════════════
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
      'id', sub.id,
      'user_id', sub.user_id,
      'total_reps', sub.total_reps,
      'display_name', sub.display_name,
      'created_at', sub.created_at,
      'rank', sub.rn
    )
    order by sub.total_reps desc, sub.created_at asc
  ), '[]'::jsonb) into entries
  from (
    select e.id, e.user_id, e.total_reps, e.display_name, e.created_at,
           row_number() over (order by e.total_reps desc, e.created_at asc) as rn
    from weekly_challenge_entries e
    where e.challenge_id = p_challenge_id
    order by e.total_reps desc, e.created_at asc
    limit greatest(1, p_limit)
  ) sub;

  return entries;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. Fix get_following — subquery LIMIT + is_public filter
-- ═══════════════════════════════════════════════════════════════
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
      'display_name', sub.display_name,
      'bio', sub.bio,
      'total_sessions', sub.total_sessions,
      'total_reps', sub.total_reps,
      'current_streak_weeks', sub.current_streak_weeks,
      'best_streak_weeks', sub.best_streak_weeks,
      'pushup_max', sub.pushup_max,
      'pullup_max', sub.pullup_max
    )
    order by sub.followed_at desc
  ), '[]'::jsonb) into result
  from (
    select f.followee_id, f.created_at as followed_at,
           p.display_name, p.bio,
           p.total_sessions, p.total_reps,
           p.current_streak_weeks, p.best_streak_weeks,
           p.pushup_max, p.pullup_max
    from user_follows f
    join public_profiles p on p.user_id = f.followee_id
    where f.follower_id = follow_assert_authenticated()
      and p.is_public = true
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. Fix get_followers — subquery LIMIT
-- ═══════════════════════════════════════════════════════════════
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
      'followed_at', sub.followed_at
    )
    order by sub.followed_at desc
  ), '[]'::jsonb) into result
  from (
    select f.follower_id, f.created_at as followed_at
    from user_follows f
    where f.followee_id = follow_assert_authenticated()
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. Fix public_profiles UPDATE policy — only allow updating display_name, bio, is_public
--    Stats columns (total_sessions, total_reps, etc.) are NOT user-mutable
-- ═══════════════════════════════════════════════════════════════
drop policy if exists public_profiles_update on public_profiles;
create policy public_profiles_update on public_profiles
  for update using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    -- Only allow updating display_name, bio, is_public — NOT stats columns
    -- Stats are only updated by refresh_my_public_profile_stats (SECURITY DEFINER)
  );

-- Revoke direct table writes from authenticated/anon — force through RPCs
revoke insert, update, delete on public_profiles from anon, authenticated;
revoke insert, update, delete on user_follows from anon, authenticated;
revoke insert, update, delete on community_reviews from anon, authenticated;
revoke insert, update, delete on weekly_challenge_entries from anon, authenticated;

-- Grant select where needed (RLS still applies)
grant select on public_profiles to anon, authenticated;
grant select on user_follows to anon, authenticated;
grant select on community_reviews to anon, authenticated;
grant select on weekly_challenge_entries to anon, authenticated;
grant select on weekly_challenges to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- 6. NULL guards for upsert_community_review
-- ═══════════════════════════════════════════════════════════════
create or replace function upsert_community_review(
  p_publication_id uuid,
  p_rating int,
  p_comment text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  existing_review community_reviews%rowtype;
  result_row community_reviews%rowtype;
  pub community_publications%rowtype;
begin
  if p_publication_id is null then
    raise exception 'invalid_publication_id';
  end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating';
  end if;
  if p_comment is null then
    p_comment := '';
  end if;
  if char_length(p_comment) > 500 then
    raise exception 'comment_too_long';
  end if;

  -- Check publication exists and is published
  select * into pub from community_publications where id = p_publication_id;
  if not found then
    raise exception 'publication_not_found';
  end if;

  -- Prevent self-review
  if pub.author_id = uid then
    raise exception 'self_review_forbidden';
  end if;

  -- Upsert
  select * into existing_review
  from community_reviews
  where publication_id = p_publication_id and user_id = uid;

  if found then
    update community_reviews
    set rating = p_rating, comment = p_comment, updated_at = now()
    where id = existing_review.id
    returning * into result_row;
  else
    insert into community_reviews (publication_id, user_id, rating, comment)
    values (p_publication_id, uid, p_rating, p_comment)
    returning * into result_row;
  end if;

  return jsonb_build_object(
    'id', result_row.id,
    'publication_id', result_row.publication_id,
    'user_id', result_row.user_id,
    'rating', result_row.rating,
    'comment', result_row.comment,
    'created_at', result_row.created_at,
    'updated_at', result_row.updated_at
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 7. Fix current_streak_weeks in refresh_my_public_profile_stats
-- ═══════════════════════════════════════════════════════════════
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
  select count(*)::int, coalesce(sum(total_reps), 0)::int
  into total_sessions, total_reps
  from workout_sessions
  where user_id = uid and status = 'completed';

  -- Pushup max test
  select coalesce(max(reps), 0)::int into pushup_max
  from max_tests where user_id = uid and program = 'pushups';

  -- Pullup max test
  select coalesce(max(reps), 0)::int into pullup_max
  from max_tests where user_id = uid and program = 'pullups';

  -- Current streak: find the group containing the most recent active week,
  -- verify it's the current or last week, then count that group's length.
  with weekly as (
    select
      date_trunc('week', completed_at) as week_start,
      count(*) as sessions
    from workout_sessions
    where user_id = uid and status = 'completed' and completed_at is not null
    group by 1
  ),
  grouped as (
    select week_start, sessions,
      week_start - (row_number() over (order by week_start) * interval '1 week') as grp
    from weekly
    where sessions > 0
  ),
  streak_groups as (
    select grp, count(*) as streak_len, max(week_start) as last_week
    from grouped
    group by grp
  )
  select coalesce(max(sg.streak_len), 0)::int into current_streak
  from streak_groups sg
  where sg.last_week >= date_trunc('week', now()) - interval '1 week';

  -- Best streak (all-time)
  with weekly as (
    select
      date_trunc('week', completed_at) as week_start,
      count(*) as sessions
    from workout_sessions
    where user_id = uid and status = 'completed' and completed_at is not null
    group by 1
  ),
  grouped as (
    select week_start, sessions,
      week_start - (row_number() over (order by week_start) * interval '1 week') as grp
    from weekly
    where sessions > 0
  ),
  streak_groups as (
    select grp, count(*) as streak_len
    from grouped
    group by grp
  )
  select coalesce(max(streak_len), 0)::int into best_streak
  from streak_groups;

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

-- ═══════════════════════════════════════════════════════════════
-- 8. Add index for max_tests (used by refresh stats)
-- ═══════════════════════════════════════════════════════════════
create index if not exists max_tests_user_program_idx
  on max_tests(user_id, program);

-- ═══════════════════════════════════════════════════════════════
-- 9. GRANT execute on public RPCs to anon + authenticated
-- ═══════════════════════════════════════════════════════════════
grant execute on function get_community_review_summary(uuid) to anon, authenticated;
grant execute on function get_active_weekly_challenge() to anon, authenticated;
grant execute on function get_weekly_challenge_leaderboard(uuid, int) to anon, authenticated;
grant execute on function get_weekly_challenge_participant_count(uuid) to anon, authenticated;
grant execute on function get_public_profile(uuid) to anon, authenticated;
grant execute on function get_follow_counts(uuid) to anon, authenticated;

-- Authenticated-only RPCs
grant execute on function upsert_community_review(uuid, int, text) to authenticated;
grant execute on function delete_community_review(uuid) to authenticated;
grant execute on function get_my_community_review(uuid) to authenticated;
grant execute on function submit_weekly_challenge_entry(uuid, int, text) to authenticated;
grant execute on function get_my_weekly_challenge_entry(uuid) to authenticated;
grant execute on function toggle_follow(uuid) to authenticated;
grant execute on function get_following(int) to authenticated;
grant execute on function get_followers(int) to authenticated;
grant execute on function upsert_my_public_profile(text, text, boolean) to authenticated;
grant execute on function get_my_public_profile() to authenticated;
grant execute on function refresh_my_public_profile_stats() to authenticated;
