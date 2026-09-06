-- 037_fix_advisor_warnings.sql
-- Fixes security advisor warnings:
-- 1. Add search_path to trigger functions
-- 2. Revoke EXECUTE from anon on auth-required functions (GRANT to authenticated only)

-- 1. Fix search_path on trigger functions
create or replace function public_profiles_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function community_reviews_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function weekly_challenge_entries_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 2. Revoke EXECUTE from anon on auth-required functions
-- (Supabase grants EXECUTE to public by default; need explicit REVOKE)
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
