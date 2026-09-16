-- 088: Profile titles (Pro perk)
--
-- Two columns:
--   profiles.selected_title          — private sync (cross-device LWW via
--                                      ui_settings_updated_at group)
--   public_profiles.title_achievement_id — public display, server-validated
--
-- upsert_my_public_profile gets a 5th parameter p_title_achievement_id:
--   NULL  → keep current value (old 4-arg clients never touch the column)
--   ''    → clear the title
--   other → must be Pro + in the title allowlist + unlocked in user_achievements
-- The 4-arg overload stays deployed so older clients keep working without
-- wiping titles.
--
-- The allowlist mirrors TITLE_IDS in src/lib/achievements/titles.ts —
-- keep in sync when adding titles.

alter table public.profiles
  add column if not exists selected_title text null;

alter table public.public_profiles
  add column if not exists title_achievement_id text null;

-- ── New upsert overload with title support ──
create or replace function public.upsert_my_public_profile(
  p_display_name text default '',
  p_bio text default '',
  p_is_public boolean default false,
  p_showcase_slots jsonb default null,
  p_title_achievement_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid;
  profile_row public_profiles%rowtype;
  v_status text;
  v_expires timestamptz;
  c_title_ids constant text[] := array[
    'first_session', 'habit_3_in_14', 'first_custom_session', 'first_squat',
    'first_publish', 'first_like', 'first_follower', 'social_butterfly',
    'first_review', 'weekend_warrior',
    'streak_4', 'streak_12', 'cycle_closed_strong', 'goal_pullups_30',
    'pr_repeat_3', 'workshop_custom', 'plan_with_legs', 'both_programs',
    'challenge_first', 'habit_builder', 'trainer_25', 'speed_demon',
    'streak_26', 'streak_52', 'sessions_100', 'goal_pushups_100',
    'goal_pullups_50', 'goal_squats_300', 'volume_10k', 'cycles_5',
    'poly_publisher', 'challenge_winner', 'triple_threat', 'pr_master',
    'cycle_master', 'followed_by_25', 'community_pillar', 'comeback_stronger',
    'legend_full_circle', 'legend_quiet_master', 'legend_grandmaster',
    'legend_community'
  ];
begin
  uid := auth.uid();
  if uid is null then raise exception 'not_authenticated'; end if;

  if char_length(p_display_name) > 60 then
    raise exception 'display_name_too_long';
  end if;
  if char_length(p_bio) > 200 then
    raise exception 'bio_too_long';
  end if;

  -- Validate a new title value (NULL = keep, '' = clear — both skip checks).
  if p_title_achievement_id is not null and p_title_achievement_id <> '' then
    if not (p_title_achievement_id = any(c_title_ids)) then
      raise exception 'title_not_eligible';
    end if;

    select subscription_status, subscription_expires_at
    into v_status, v_expires
    from public.profiles
    where id = uid;

    if not (
      v_status = 'lifetime'
      or (v_status in ('pro', 'trial') and (v_expires is null or v_expires > now()))
    ) then
      raise exception 'title_requires_pro';
    end if;

    if not exists (
      select 1 from public.user_achievements
      where user_id = uid and achievement_id = p_title_achievement_id
    ) then
      raise exception 'title_not_unlocked';
    end if;
  end if;

  insert into public_profiles (user_id, display_name, bio, is_public, showcase_slots, title_achievement_id)
  values (uid, p_display_name, p_bio, p_is_public, p_showcase_slots, nullif(p_title_achievement_id, ''))
  on conflict (user_id)
  do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    is_public = excluded.is_public,
    showcase_slots = excluded.showcase_slots,
    title_achievement_id = case
      when p_title_achievement_id is null then public_profiles.title_achievement_id
      else nullif(excluded.title_achievement_id, '')
    end,
    updated_at = now()
  returning * into profile_row;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'showcase_slots', profile_row.showcase_slots,
    'title_achievement_id', profile_row.title_achievement_id
  );
end;
$$;

grant execute on function public.upsert_my_public_profile(text, text, boolean, jsonb, text) to authenticated;

-- ── Read paths: expose title_achievement_id ──
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
      'top_achievements', coalesce(sub.top_achievements, '[]'::jsonb),
      'title_achievement_id', sub.title_achievement_id
    )
    order by sub.followed_at desc
  ), '[]'::jsonb) into result
  from (
    select f.followee_id, f.created_at as followed_at,
           p.display_name, p.bio,
           p.total_sessions, p.total_reps,
           p.current_streak_weeks, p.best_streak_weeks,
           p.title_achievement_id,
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
      'title_achievement_id', sub.title_achievement_id,
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
      p.title_achievement_id,
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
    'title_achievement_id', profile_row.title_achievement_id,
    'is_following', is_following
  );
end;
$$;

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
    'title_achievement_id', profile_row.title_achievement_id,
    'updated_at', profile_row.updated_at
  );
end;
$$;

grant execute on function public.get_following(integer) to authenticated;
grant execute on function public.get_followers(integer) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_my_public_profile() to authenticated;
