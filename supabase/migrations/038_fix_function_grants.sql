-- 038_fix_function_grants.sql
-- Supabase grants EXECUTE to PUBLIC by default; need to REVOKE FROM PUBLIC and grant explicitly.

-- Revoke EXECUTE from PUBLIC on ALL community/follow/challenge functions
revoke execute on function delete_community_review(uuid) from public;
revoke execute on function follow_assert_authenticated() from public;
revoke execute on function get_followers(int) from public;
revoke execute on function get_following(int) from public;
revoke execute on function upsert_community_review(uuid, int, text) from public;
revoke execute on function get_my_community_review(uuid) from public;
revoke execute on function submit_weekly_challenge_entry(uuid, int, text) from public;
revoke execute on function get_my_weekly_challenge_entry(uuid) from public;
revoke execute on function toggle_follow(uuid) from public;
revoke execute on function upsert_my_public_profile(text, text, boolean) from public;
revoke execute on function get_my_public_profile() from public;
revoke execute on function refresh_my_public_profile_stats() from public;
revoke execute on function weekly_challenge_assert_authenticated() from public;
revoke execute on function publish_community_plan(uuid, text, text, text[], jsonb, text, text) from public;

-- Also revoke from anon explicitly (in case of direct grant)
revoke execute on function delete_community_review(uuid) from anon;
revoke execute on function follow_assert_authenticated() from anon;
revoke execute on function get_followers(int) from anon;
revoke execute on function get_following(int) from anon;
revoke execute on function upsert_community_review(uuid, int, text) from anon;
revoke execute on function get_my_community_review(uuid) from anon;
revoke execute on function submit_weekly_challenge_entry(uuid, int, text) from anon;
revoke execute on function get_my_weekly_challenge_entry(uuid) from anon;
revoke execute on function toggle_follow(uuid) from anon;
revoke execute on function upsert_my_public_profile(text, text, boolean) from anon;
revoke execute on function get_my_public_profile() from anon;
revoke execute on function refresh_my_public_profile_stats() from anon;
revoke execute on function weekly_challenge_assert_authenticated() from anon;
revoke execute on function publish_community_plan(uuid, text, text, text[], jsonb, text, text) from anon;

-- Grant EXECUTE to authenticated only (auth-required functions)
grant execute on function delete_community_review(uuid) to authenticated;
grant execute on function follow_assert_authenticated() to authenticated;
grant execute on function get_followers(int) to authenticated;
grant execute on function get_following(int) to authenticated;
grant execute on function upsert_community_review(uuid, int, text) to authenticated;
grant execute on function get_my_community_review(uuid) to authenticated;
grant execute on function submit_weekly_challenge_entry(uuid, int, text) to authenticated;
grant execute on function get_my_weekly_challenge_entry(uuid) to authenticated;
grant execute on function toggle_follow(uuid) to authenticated;
grant execute on function upsert_my_public_profile(text, text, boolean) to authenticated;
grant execute on function get_my_public_profile() to authenticated;
grant execute on function refresh_my_public_profile_stats() to authenticated;
grant execute on function publish_community_plan(uuid, text, text, text[], jsonb, text, text) to authenticated;

-- Public functions (anon + authenticated) — grant explicitly after revoking from public
grant execute on function get_active_weekly_challenge() to anon, authenticated;
grant execute on function get_community_review_summary(uuid) to anon, authenticated;
grant execute on function get_follow_counts(uuid) to anon, authenticated;
grant execute on function get_public_profile(uuid) to anon, authenticated;
grant execute on function get_weekly_challenge_leaderboard(uuid, int) to anon, authenticated;
grant execute on function get_weekly_challenge_participant_count(uuid) to anon, authenticated;
