-- 076: Revoke EXECUTE from anon on upsert_user_exercise_safe
-- Migration 074 granted EXECUTE to authenticated but didn't revoke from anon/PUBLIC,
-- allowing unauthenticated users to upsert exercises for any user_id via the RPC.
-- This is a write function (SECURITY DEFINER) and must be authenticated-only.

REVOKE EXECUTE ON FUNCTION upsert_user_exercise_safe(
  p_id uuid, p_user_id uuid, p_name text, p_primary_metric text,
  p_rest_default_sec integer, p_archived boolean, p_muscle_group text,
  p_source text, p_duration_display_unit text,
  p_created_at timestamptz, p_updated_at timestamptz
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION upsert_user_exercise_safe(
  p_id uuid, p_user_id uuid, p_name text, p_primary_metric text,
  p_rest_default_sec integer, p_archived boolean, p_muscle_group text,
  p_source text, p_duration_display_unit text,
  p_created_at timestamptz, p_updated_at timestamptz
) FROM anon;

GRANT EXECUTE ON FUNCTION upsert_user_exercise_safe(
  p_id uuid, p_user_id uuid, p_name text, p_primary_metric text,
  p_rest_default_sec integer, p_archived boolean, p_muscle_group text,
  p_source text, p_duration_display_unit text,
  p_created_at timestamptz, p_updated_at timestamptz
) TO authenticated;

NOTIFY pgrst, 'reload schema';
