-- Fix dangling exercise references in workout_sessions.exercise_logs_json and
-- set_results.exercise_id that point to deleted exercise afc35eec-9c9d-4354-9832-6e18b7b4862e.
-- The exercise was deleted (tombstoned on 2026-09-11) but historical session logs
-- and set_results still reference it. The plan was updated to use
-- cbc34d4d-a1c1-43d3-b139-4c0997ff9d20 ("Wyciskanie"), so we remap the old ID.

-- Fix set_results.exercise_id
UPDATE set_results
  SET exercise_id = 'cbc34d4d-a1c1-43d3-b139-4c0997ff9d20'::uuid
  WHERE exercise_id = 'afc35eec-9c9d-4354-9832-6e18b7b4862e'::uuid;

-- Fix workout_sessions.exercise_logs_json
DO $$
DECLARE
  ws_row RECORD;
  new_logs JSONB;
  log_row JSONB;
BEGIN
  FOR ws_row IN
    SELECT id, exercise_logs_json
    FROM workout_sessions
    WHERE exercise_logs_json IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(exercise_logs_json) AS el
        WHERE el->>'exerciseId' = 'afc35eec-9c9d-4354-9832-6e18b7b4862e'
      )
  LOOP
    new_logs = '[]'::jsonb;
    FOR log_row IN SELECT * FROM jsonb_array_elements(ws_row.exercise_logs_json) LOOP
      IF log_row->>'exerciseId' = 'afc35eec-9c9d-4354-9832-6e18b7b4862e' THEN
        new_logs = new_logs || jsonb_set(log_row, '{exerciseId}', to_jsonb('cbc34d4d-a1c1-43d3-b139-4c0997ff9d20'::text));
      ELSE
        new_logs = new_logs || log_row;
      END IF;
    END LOOP;
    UPDATE workout_sessions SET exercise_logs_json = new_logs WHERE id = ws_row.id;
  END LOOP;
END $$;
