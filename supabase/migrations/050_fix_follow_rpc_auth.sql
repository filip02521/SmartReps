-- ═══════════════════════════════════════════════════════════════
-- 050: Fix all follow RPCs — replace follow_assert_authenticated() with auth.uid()
--
-- Problem: All follow RPCs used follow_assert_authenticated() either as
-- a default value in DECLARE or in WHERE clauses. In nested SECURITY
-- DEFINER contexts, auth.uid() may not be available at variable
-- initialization time, causing 400 Bad Request even with a valid session.
-- This affected get_following, get_followers, get_my_public_profile,
-- toggle_follow, upsert_my_public_profile, and get_public_profile.
--
-- Fix: Replace all follow_assert_authenticated() calls with direct
-- auth.uid() checks in the function body.
-- ═══════════════════════════════════════════════════════════════

-- get_following
create or replace function public.get_following(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  result jsonb;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;

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
           (select cp.author_display_name from community_publications cp where cp.author_id = f.followee_id and cp.author_display_name is not null and cp.author_display_name <> '' limit 1) as community_name
    from user_follows f
    left join public_profiles p on p.user_id = f.followee_id
    where f.follower_id = uid
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

-- get_followers
create or replace function public.get_followers(p_limit integer default 50)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  result jsonb;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;

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
      p.total_sessions, p.total_reps,
      p.current_streak_weeks, p.best_streak_weeks,
      p.pushup_max, p.pullup_max,
      f.created_at as followed_at,
      (select cp.author_display_name from community_publications cp where cp.author_id = f.follower_id and cp.author_display_name is not null and cp.author_display_name <> '' limit 1) as community_name
    from user_follows f
    left join public_profiles p on p.user_id = f.follower_id
    where f.followee_id = uid
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

-- get_my_public_profile
create or replace function public.get_my_public_profile()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  profile_row public_profiles%rowtype;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into profile_row from public_profiles where user_id = uid;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'total_sessions', profile_row.total_sessions,
    'total_reps', profile_row.total_reps,
    'current_streak_weeks', profile_row.current_streak_weeks,
    'best_streak_weeks', profile_row.best_streak_weeks,
    'pushup_max', profile_row.pushup_max,
    'pullup_max', profile_row.pullup_max,
    'updated_at', profile_row.updated_at
  );
end;
$$;

-- toggle_follow
create or replace function public.toggle_follow(p_followee_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  following boolean;
  follower_count int;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;

  if p_followee_id = uid then
    raise exception 'cannot_follow_self';
  end if;

  -- Check if already following FIRST — allow unfollow regardless of visibility
  if exists (
    select 1 from user_follows where follower_id = uid and followee_id = p_followee_id
  ) then
    delete from user_follows where follower_id = uid and followee_id = p_followee_id;
    following := false;
  else
    if not exists (
      select 1 from public_profiles where user_id = p_followee_id and is_public = true
    ) then
      raise exception 'user_not_public';
    end if;
    insert into user_follows (follower_id, followee_id) values (uid, p_followee_id);
    following := true;
  end if;

  select count(*) into follower_count
  from user_follows where followee_id = p_followee_id;

  return jsonb_build_object(
    'following', following,
    'follower_count', follower_count
  );
end;
$$;

-- upsert_my_public_profile
create or replace function public.upsert_my_public_profile(p_display_name text default '', p_bio text default '', p_is_public boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  profile_row public_profiles%rowtype;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;

  if char_length(p_display_name) > 60 then
    raise exception 'display_name_too_long';
  end if;
  if char_length(p_bio) > 200 then
    raise exception 'bio_too_long';
  end if;

  insert into public_profiles (user_id, display_name, bio, is_public)
  values (uid, p_display_name, p_bio, p_is_public)
  on conflict (user_id)
  do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    is_public = excluded.is_public,
    updated_at = now()
  returning * into profile_row;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'updated_at', profile_row.updated_at
  );
end;
$$;

-- get_public_profile
create or replace function public.get_public_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  profile_row public_profiles%rowtype;
  is_following boolean;
  uid uuid;
begin
  select * into profile_row from public_profiles where user_id = p_user_id;
  if not found or not profile_row.is_public then
    if p_user_id <> auth.uid() then
      raise exception 'profile_not_public';
    end if;
  end if;

  uid := auth.uid();
  is_following := false;
  if uid is not null and uid <> p_user_id then
    select exists(
      select 1 from user_follows where follower_id = uid and followee_id = p_user_id
    ) into is_following;
  end if;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'total_sessions', profile_row.total_sessions,
    'total_reps', profile_row.total_reps,
    'current_streak_weeks', profile_row.current_streak_weeks,
    'best_streak_weeks', profile_row.best_streak_weeks,
    'pushup_max', profile_row.pushup_max,
    'pullup_max', profile_row.pullup_max,
    'is_following', is_following
  );
end;
$$;

-- Re-grant execute to authenticated
grant execute on function public.get_following(integer) to authenticated;
grant execute on function public.get_followers(integer) to authenticated;
grant execute on function public.get_my_public_profile() to authenticated;
grant execute on function public.toggle_follow(uuid) to authenticated;
grant execute on function public.upsert_my_public_profile(text, text, boolean) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
