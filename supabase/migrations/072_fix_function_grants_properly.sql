-- Revoke EXECUTE from PUBLIC (includes anon), then grant only to authenticated
-- This properly restricts write functions to signed-in users

REVOKE EXECUTE ON FUNCTION ensure_weekly_challenge(timestamp with time zone) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ensure_weekly_challenge(timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION submit_challenge_progress(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_challenge_progress(uuid, integer, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION upsert_my_public_profile(text, text, boolean, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_my_public_profile(text, text, boolean, jsonb) TO authenticated;
