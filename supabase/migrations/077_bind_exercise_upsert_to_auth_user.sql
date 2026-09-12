CREATE OR REPLACE FUNCTION public.upsert_user_exercise_safe(
  p_id uuid,
  p_user_id uuid,
  p_name text,
  p_primary_metric text,
  p_rest_default_sec integer,
  p_archived boolean,
  p_muscle_group text,
  p_source text,
  p_duration_display_unit text,
  p_created_at timestamptz,
  p_updated_at timestamptz
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO existing_id
  FROM public.user_exercises
  WHERE user_id = p_user_id AND name = p_name
  LIMIT 1;

  IF existing_id IS NOT NULL AND existing_id <> p_id THEN
    UPDATE public.user_exercises
    SET
      primary_metric = p_primary_metric,
      rest_default_sec = p_rest_default_sec,
      archived = p_archived,
      muscle_group = p_muscle_group,
      source = p_source,
      duration_display_unit = p_duration_display_unit,
      updated_at = p_updated_at
    WHERE id = existing_id AND user_id = p_user_id;
    RETURN existing_id;
  END IF;

  INSERT INTO public.user_exercises (
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
    updated_at = EXCLUDED.updated_at
  WHERE user_exercises.user_id = p_user_id;

  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_user_exercise_safe(
  uuid, uuid, text, text, integer, boolean, text, text, text, timestamptz, timestamptz
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.upsert_user_exercise_safe(
  uuid, uuid, text, text, integer, boolean, text, text, text, timestamptz, timestamptz
) TO authenticated;

NOTIFY pgrst, 'reload schema';
