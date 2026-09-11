-- Revoke EXECUTE from PUBLIC, anon, and authenticated; then grant only to authenticated
-- This properly restricts write functions to signed-in users
-- Note: REVOKE FROM PUBLIC alone is not enough — Supabase grants EXECUTE to anon
-- explicitly, so we must also REVOKE FROM anon.

REVOKE EXECUTE ON FUNCTION ensure_weekly_challenge(timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION ensure_weekly_challenge(timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION ensure_weekly_challenge(timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION submit_challenge_progress(uuid, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION submit_challenge_progress(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION submit_challenge_progress(uuid, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION upsert_my_public_profile(text, text, boolean, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION upsert_my_public_profile(text, text, boolean, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION upsert_my_public_profile(text, text, boolean, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
