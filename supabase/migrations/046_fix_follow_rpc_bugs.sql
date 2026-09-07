-- ═══════════════════════════════════════════════════════════════
-- 046: Fix follow system RPC bugs
--
-- Bug 1: toggle_follow blocks unfollow of now-private users.
--   If a followee made their profile private after you followed them,
--   toggle_follow raised 'user_not_public' before checking if you
--   already follow them — making it impossible to unfollow.
--   Fix: check existing follow state FIRST. If already following,
--   allow unfollow regardless of profile visibility.
--
-- Bug 2: get_followers uses INNER JOIN, hiding followers without
--   a public_profiles row. A user can follow without having a public
--   profile (toggle_follow only requires the followee to be public).
--   Fix: use LEFT JOIN, return placeholder data for missing profiles.
--
-- Bug 3: get_following filters by is_public = true, hiding followees
--   who made their profile private. This creates "stuck follows" —
--   they count in get_follow_counts but can't be managed in the UI.
--   Fix: remove is_public filter so all followed users are visible.
-- ═══════════════════════════════════════════════════════════════

-- ── Fix 1: toggle_follow — allow unfollow of private users ──
create or replace function toggle_follow(
  p_followee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := follow_assert_authenticated();
  following boolean;
  follower_count int;
begin
  if p_followee_id = uid then
    raise exception 'cannot_follow_self';
  end if;

  -- Check if already following FIRST — allow unfollow regardless of visibility
  if exists (
    select 1 from user_follows where follower_id = uid and followee_id = p_followee_id
  ) then
    -- Already following → unfollow (no public-profile check needed)
    delete from user_follows where follower_id = uid and followee_id = p_followee_id;
    following := false;
  else
    -- Not following → check followee has public profile before allowing follow
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

-- Re-grant (function signature unchanged)
revoke execute on function toggle_follow(uuid) from public;
revoke execute on function toggle_follow(uuid) from anon;
grant execute on function toggle_follow(uuid) to authenticated;

-- ── Fix 2: get_followers — LEFT JOIN so all followers show ──
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
      'display_name', coalesce(sub.display_name, ''),
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
      f.created_at as followed_at
    from user_follows f
    left join public_profiles p on p.user_id = f.follower_id
    where f.followee_id = follow_assert_authenticated()
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

-- Re-grant
revoke execute on function get_followers(int) from public;
revoke execute on function get_followers(int) from anon;
grant execute on function get_followers(int) to authenticated;

-- ── Fix 3: get_following — remove is_public filter (show all followed users) ──
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
      'display_name', coalesce(sub.display_name, ''),
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
           p.pushup_max, p.pullup_max
    from user_follows f
    left join public_profiles p on p.user_id = f.followee_id
    where f.follower_id = follow_assert_authenticated()
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

-- Re-grant
revoke execute on function get_following(int) from public;
revoke execute on function get_following(int) from anon;
grant execute on function get_following(int) to authenticated;
