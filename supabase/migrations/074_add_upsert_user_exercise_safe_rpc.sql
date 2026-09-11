-- RPC for safe exercise upsert that does NOT change the primary key on conflict.
-- The old upsertUserExercise used ON CONFLICT (user_id, name) DO UPDATE SET id=EXCLUDED.id
-- which changed the cloud exercise's primary key to match the local ID.
-- This broke plan_json and exercise_logs_json references to the old cloud ID.
-- This RPC keeps the existing cloud ID and only updates non-id fields.

CREATE OR REPLACE FUNCTION upsert_user_exercise_safe(
  p_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_primary_metric TEXT,
  p_rest_default_sec INTEGER,
  p_archived BOOLEAN,
  p_muscle_group TEXT,
  p_source TEXT,
  p_duration_display_unit TEXT,
  p_created_at TIMESTAMPTZ,
  p_updated_at TIMESTAMPTZ
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
BEGIN
  -- Check if a row with the same (user_id, name) already exists
  SELECT id INTO existing_id
  FROM user_exercises
  WHERE user_id = p_user_id AND name = p_name
  LIMIT 1;

  IF existing_id IS NOT NULL AND existing_id != p_id THEN
    -- Conflict: same name, different ID. Keep the existing cloud ID.
    -- Only update non-id fields.
    UPDATE user_exercises
    SET
      primary_metric = p_primary_metric,
      rest_default_sec = p_rest_default_sec,
      archived = p_archived,
      muscle_group = p_muscle_group,
      source = p_source,
      duration_display_unit = p_duration_display_unit,
      updated_at = p_updated_at
    WHERE id = existing_id;
    RETURN existing_id;
  END IF;

  -- No conflict (or same ID) — do a normal upsert by primary key
  INSERT INTO user_exercises (
    id, user_id, name, primary_metric, rest_default_sec,
    archived, muscle_group, source, duration_display_unit,
    created_at, updated_at
  ) VALUES (
    p_id, p_user_id, p_name, p_primary_metric, p_rest_default_sec,
    p_archived, p_muscle_group, p_source, p_duration_display_unit,
    p_created_at, p_updated_at
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    primary_metric = EXCLUDED.primary_metric,
    rest_default_sec = EXCLUDED.rest_default_sec,
    archived = EXCLUDED.archived,
    muscle_group = EXCLUDED.muscle_group,
    source = EXCLUDED.source,
    duration_display_unit = EXCLUDED.duration_display_unit,
    updated_at = EXCLUDED.updated_at;
  -- Note: user_id is intentionally NOT updated on conflict — changing the
  -- owner of an existing exercise would be a data integrity violation.

  RETURN p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION upsert_user_exercise_safe TO authenticated;
