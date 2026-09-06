-- ═══════════════════════════════════════════════════════════════
-- 040: Enhance get_followers to return profile info (display_name, bio, stats)
-- Previously only returned follower_id + followed_at.
-- Now returns full profile data like get_following does, so the client
-- can render a followers list with avatars, names, and stats.
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
      'display_name', sub.display_name,
      'bio', sub.bio,
      'total_sessions', sub.total_sessions,
      'total_reps', sub.total_reps,
      'current_streak_weeks', sub.current_streak_weeks,
      'best_streak_weeks', sub.best_streak_weeks,
      'pushup_max', sub.pushup_max,
      'pullup_max', sub.pullup_max,
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
    join public_profiles p on p.user_id = f.follower_id
    where f.followee_id = follow_assert_authenticated()
    order by f.created_at desc
    limit greatest(1, p_limit)
  ) sub;

  return result;
end;
$$;

-- Re-grant (function signature unchanged: get_followers(int))
-- Existing grants from 038_fix_function_grants.sql remain valid,
-- but re-apply to be safe after recreate.
revoke execute on function get_followers(int) from public;
revoke execute on function get_followers(int) from anon;
grant execute on function get_followers(int) to authenticated;
