-- ═══════════════════════════════════════════════════════════════
-- 052: Sync achievement showcase slots to cloud + return 4 badges
--
-- The achievement showcase (gablota) was localStorage-only. Now we
-- sync the user's pinned slots to public_profiles so other users
-- see the same 4 badges in follow cards that the user has in their
-- showcase.
--
-- Changes:
-- 1. Add showcase_slots jsonb column to public_profiles (null = auto)
-- 2. upsert_my_public_profile accepts p_showcase_slots parameter
-- 3. get_user_achievements_public returns 4 badges, using pinned
--    slots if available, otherwise auto-ranked
-- 4. get_following/get_followers/get_public_profile return 4 badges
-- 5. get_my_public_profile returns showcase_slots
-- ═══════════════════════════════════════════════════════════════

-- Step 1: Add showcase_slots column
alter table public_profiles
  add column if not exists showcase_slots jsonb default null;

-- Step 2: Update get_user_achievements_public to accept pinned slots + return 4
create or replace function public.get_user_achievements_public(
  p_user_id uuid,
  p_limit int default 4,
  p_pinned_slots jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
  pinned_ids text[];
  pinned_json jsonb;
begin
  -- If pinned slots provided, use them (filter to only unlocked + non-secret)
  if p_pinned_slots is not null and jsonb_array_length(p_pinned_slots) > 0 then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'achievement_id', t.achievement_id,
        'tier_level', coalesce(t.tier_level, 0)
      )
    ), '[]'::jsonb) into result
    from (
      select ua.achievement_id, ua.tier_level
      from user_achievements ua
      where ua.user_id = p_user_id
        and ua.achievement_id = any(
          select jsonb_array_elements_text(p_pinned_slots)
        )
        and ua.achievement_id not in ('secret_night', 'secret_precision')
      order by
        -- Preserve pinned order
        case
          when jsonb_array_elements_text(p_pinned_slots) = ua.achievement_id
          then array_position(
            array(select jsonb_array_elements_text(p_pinned_slots)),
            ua.achievement_id
          )
          else 999
        end
      limit greatest(1, p_limit)
    ) t;

    return result;
  end if;

  -- Auto mode: rank by rarity (legendary > rare > common), then tier, then recency
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
      -- Rarity rank: legendary=3, rare=2, common=1 (mirrors showcase.ts)
      case
        when ua.achievement_id in ('legend_full_circle', 'legend_grandmaster', 'legend_quiet_master', 'streak_52') then 3
        when ua.achievement_id in ('streak_26', 'sessions_100', 'volume_10k', 'goal_pushups_100', 'goal_pullups_50', 'comeback_stronger', 'cycle_closed_strong') then 3
        when ua.achievement_id in ('streak_12', 'cycles_5', 'pr_master', 'habit_builder', 'custom_sessions_25', 'trainer_25', 'poly_publisher', 'community_pillar') then 2
        when ua.achievement_id in ('first_session', 'habit_3_in_14', 'first_custom_session', 'streak_1', 'streak_4') then 1
        when ua.achievement_id in ('first_publish', 'first_like', 'first_import', 'first_trained', 'plan_with_legs') then 1
        when ua.achievement_id in ('liked_author', 'imported_author') then 1
        else 1
      end desc,
      coalesce(ua.tier_level, 0) desc,
      ua.unlocked_at desc
    limit greatest(1, p_limit)
  ) t;

  return result;
end;
$$;

grant execute on function public.get_user_achievements_public(uuid, int, jsonb) to authenticated;

-- Step 3: Update upsert_my_public_profile to accept showcase_slots
create or replace function public.upsert_my_public_profile(
  p_display_name text default '',
  p_bio text default '',
  p_is_public boolean default false,
  p_showcase_slots jsonb default null
)
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

  insert into public_profiles (user_id, display_name, bio, is_public, showcase_slots)
  values (uid, p_display_name, p_bio, p_is_public, p_showcase_slots)
  on conflict (user_id)
  do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    is_public = excluded.is_public,
    showcase_slots = excluded.showcase_slots,
    updated_at = now()
  returning * into profile_row;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'showcase_slots', profile_row.showcase_slots
  );
end;
$$;

grant execute on function public.upsert_my_public_profile(text, text, boolean, jsonb) to authenticated;

-- Step 4: Update get_following to return 4 badges using showcase_slots
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
           public.get_user_achievements_public(f.followee_id, 4, p.showcase_slots) as top_achievements,
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

-- Step 5: Update get_followers to return 4 badges using showcase_slots
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
      public.get_user_achievements_public(f.follower_id, 4, p.showcase_slots) as top_achievements,
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

-- Step 6: Update get_public_profile to return 4 badges + showcase_slots
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

  top_achievements := public.get_user_achievements_public(p_user_id, 4, profile_row.showcase_slots);

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

-- Step 7: Update get_my_public_profile to return showcase_slots
create or replace function public.get_my_public_profile()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  profile_row public_profiles%rowtype;
  achievement_count int;
  top_achievements jsonb;
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into profile_row from public_profiles where user_id = uid;
  if not found then return null; end if;

  select count(*) into achievement_count
  from user_achievements ua
  where ua.user_id = uid
    and ua.achievement_id not in ('secret_night', 'secret_precision');

  top_achievements := public.get_user_achievements_public(uid, 4, profile_row.showcase_slots);

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
    'showcase_slots', profile_row.showcase_slots,
    'updated_at', profile_row.updated_at
  );
end;
$$;

-- Re-grant
grant execute on function public.get_following(integer) to authenticated;
grant execute on function public.get_followers(integer) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_my_public_profile() to authenticated;
