-- ═══════════════════════════════════════════════════════════════
-- 051: Public achievement showcase for follow lists
--
-- Replaces pushup_max/pullup_max in public follow profiles with
-- achievement badges — a more meaningful indicator of experience
-- and engagement than raw max test numbers.
--
-- Changes:
-- 1. New RPC get_user_achievements_public(p_user_id, p_limit)
--    Returns top N non-secret achievements ranked by rarity then tier.
-- 2. get_following now returns achievement_count + top_achievements
--    instead of pushup_max/pullup_max.
-- 3. get_followers now returns achievement_count + top_achievements.
-- 4. get_public_profile now returns achievement_count + top_achievements
--    instead of pushup_max/pullup_max.
-- ═══════════════════════════════════════════════════════════════

-- Helper: get a user's top achievements as JSON array
create or replace function public.get_user_achievements_public(p_user_id uuid, p_limit int default 3)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'achievement_id', t.achievement_id,
      'tier_level', coalesce(t.tier_level, 0)
    )
  ), '[]'::jsonb) into result
  from (
    select ua.achievement_id, ua.tier_level, ua.unlocked_at
    from user_achievements ua
    where ua.user_id = p_user_id
      and ua.achievement_id not in ('secret_night', 'secret_precision')
    order by
      case ua.achievement_id
        when 'legend_full_circle' then 4
        when 'legend_grandmaster' then 4
        when 'streak_52' then 3
        when 'streak_26' then 3
        when 'sessions_100' then 3
        when 'volume_10k' then 3
        when 'goal_pushups_100' then 3
        when 'goal_pullups_50' then 3
        when 'comeback_stronger' then 3
        when 'cycle_closed_strong' then 2
        when 'streak_12' then 2
        when 'cycles_5' then 2
        when 'pr_master' then 2
        when 'habit_builder' then 2
        when 'custom_sessions_25' then 2
        when 'trainer_25' then 2
        when 'poly_publisher' then 2
        when 'community_pillar' then 2
        when 'legend_quiet_master' then 2
        when 'first_session' then 1
        when 'habit_3_in_14' then 1
        when 'first_custom_session' then 1
        when 'streak_1' then 1
        when 'streak_4' then 1
        when 'first_publish' then 1
        when 'first_like' then 1
        when 'first_import' then 1
        when 'first_trained' then 1
        when 'plan_with_legs' then 1
        when 'liked_author' then 1
        when 'imported_author' then 1
        else 0
      end desc,
      coalesce(ua.tier_level, 0) desc,
      ua.unlocked_at desc
    limit greatest(1, p_limit)
  ) t;

  return result;
end;
$$;

grant execute on function public.get_user_achievements_public(uuid, int) to authenticated;

-- Update get_following
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
      'achievement_count', coalesce(sub.achievement_count, 0),
      'top_achievements', coalesce(sub.top_achievements, '[]'::jsonb)
    )
    order by sub.followed_at desc
  ), '[]'::jsonb) into result
  from (
    select f.followee_id, f.created_at as followed_at,
           p.display_name, p.bio,
           p.total_sessions, p.total_reps,
           p.current_streak_weeks, p.best_streak_weeks,
           (select count(*) from user_achievements ua where ua.user_id = f.followee_id and ua.achievement_id not in ('secret_night', 'secret_precision')) as achievement_count,
           public.get_user_achievements_public(f.followee_id, 3) as top_achievements,
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

-- Update get_followers
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
      'achievement_count', coalesce(sub.achievement_count, 0),
      'top_achievements', coalesce(sub.top_achievements, '[]'::jsonb),
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
      (select count(*) from user_achievements ua where ua.user_id = f.follower_id and ua.achievement_id not in ('secret_night', 'secret_precision')) as achievement_count,
      public.get_user_achievements_public(f.follower_id, 3) as top_achievements,
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

-- Update get_public_profile — remove pushup_max/pullup_max, add achievements
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
  achievement_count int;
  top_achievements jsonb;
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

  select count(*) into achievement_count
  from user_achievements ua
  where ua.user_id = p_user_id
    and ua.achievement_id not in ('secret_night', 'secret_precision');

  top_achievements := public.get_user_achievements_public(p_user_id, 4);

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'total_sessions', profile_row.total_sessions,
    'total_reps', profile_row.total_reps,
    'current_streak_weeks', profile_row.current_streak_weeks,
    'best_streak_weeks', profile_row.best_streak_weeks,
    'achievement_count', achievement_count,
    'top_achievements', top_achievements,
    'is_following', is_following
  );
end;
$$;

-- Re-grant
grant execute on function public.get_following(integer) to authenticated;
grant execute on function public.get_followers(integer) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
