-- Fix function security issues:
-- 1. recompute_publication_rating_summary: missing search_path (WARN from advisor)
-- 2. ensure_weekly_challenge: callable by anon as SECURITY DEFINER (should be authenticated only)
-- 3. submit_challenge_progress: callable by anon as SECURITY DEFINER (should be authenticated only)
-- 4. upsert_my_public_profile (4-arg): callable by anon as SECURITY DEFINER (should be authenticated only)
--
-- Note: REVOKE FROM anon alone doesn't work because PostgreSQL grants EXECUTE to PUBLIC by default,
-- and anon is a member of PUBLIC. Must REVOKE FROM PUBLIC, then GRANT TO authenticated.

-- 1. Set search_path on recompute_publication_rating_summary (trigger function)
ALTER FUNCTION recompute_publication_rating_summary() SET search_path = public;

-- 2-4. Revoke EXECUTE from PUBLIC (includes anon), grant only to authenticated
REVOKE EXECUTE ON FUNCTION ensure_weekly_challenge(timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_weekly_challenge(timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION submit_challenge_progress(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_challenge_progress(uuid, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION upsert_my_public_profile(text, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_my_public_profile(text, text, boolean, jsonb) TO authenticated;
