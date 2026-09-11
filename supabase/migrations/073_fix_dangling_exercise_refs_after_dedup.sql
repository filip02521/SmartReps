-- Fix dangling exercise references in custom_plans.plan_json and
-- workout_sessions.exercise_logs_json after migration 068 (dedup).
-- The dedup migration re-pointed set_results.exercise_id to kept exercises
-- but did NOT update plan_json or exercise_logs_json, leaving stale refs.
-- This migration finds the mapping via set_results (matched by exercise_order)
-- and updates both plan_json and exercise_logs_json.

DO $$
DECLARE
  plan_row RECORD;
  day_row JSONB;
  ex_row JSONB;
  new_days JSONB;
  new_exercises JSONB;
  kept_id UUID;
  session_row RECORD;
  new_logs JSONB;
  log_row JSONB;
  new_log JSONB;
BEGIN
  -- Fix custom_plans.plan_json
  FOR plan_row IN
    SELECT cp.id, cp.plan_json, cp.user_id
    FROM custom_plans cp
    WHERE EXISTS (
      SELECT 1 FROM jsonb_array_elements(cp.plan_json->'days') AS d,
                   jsonb_array_elements(d->'exercises') AS je
      WHERE je.value->>'exerciseId' IS NOT NULL
        AND je.value->>'exerciseId' != ''
        AND NOT EXISTS (SELECT 1 FROM user_exercises ue WHERE ue.id = (je.value->>'exerciseId')::uuid)
    )
  LOOP
    new_days = '[]'::jsonb;
    FOR day_row IN SELECT * FROM jsonb_array_elements(plan_row.plan_json->'days') LOOP
      new_exercises = '[]'::jsonb;
      FOR ex_row IN SELECT * FROM jsonb_array_elements(day_row->'exercises') LOOP
        IF ex_row->>'exerciseId' IS NOT NULL AND ex_row->>'exerciseId' != ''
           AND NOT EXISTS (SELECT 1 FROM user_exercises ue WHERE ue.id = (ex_row->>'exerciseId')::uuid) THEN
          -- Find kept exercise via set_results (matched by exercise_order)
          SELECT sr.exercise_id INTO kept_id
          FROM set_results sr
          JOIN workout_sessions ws ON ws.id = sr.session_id
          WHERE ws.cycle_id = plan_row.id::text
            AND ws.program = 'custom'
            AND sr.exercise_order = (ex_row->>'order')::int
            AND EXISTS (SELECT 1 FROM user_exercises ue WHERE ue.id = sr.exercise_id)
          LIMIT 1;
          IF kept_id IS NOT NULL THEN
            new_exercises = new_exercises || jsonb_set(ex_row, '{exerciseId}', to_jsonb(kept_id::text));
          ELSE
            -- No mapping found — skip this exercise (remove from plan)
            -- User can add it back manually
            RAISE NOTICE 'Removing unmapped exercise % from plan %', ex_row->>'exerciseId', plan_row.id;
          END IF;
          kept_id = NULL;
        ELSE
          new_exercises = new_exercises || ex_row;
        END IF;
      END LOOP;
      new_days = new_days || jsonb_set(day_row, '{exercises}', new_exercises);
    END LOOP;
    UPDATE custom_plans SET plan_json = jsonb_set(plan_row.plan_json, '{days}', new_days)
    WHERE id = plan_row.id;
  END LOOP;

  -- Fix workout_sessions.exercise_logs_json
  FOR session_row IN
    SELECT ws.id, ws.exercise_logs_json, ws.user_id
    FROM workout_sessions ws
    WHERE ws.exercise_logs_json IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(ws.exercise_logs_json) AS el
        WHERE el->>'exerciseId' IS NOT NULL
          AND el->>'exerciseId' != ''
          AND NOT EXISTS (SELECT 1 FROM user_exercises ue WHERE ue.id = (el->>'exerciseId')::uuid)
      )
  LOOP
    new_logs = '[]'::jsonb;
    FOR log_row IN SELECT * FROM jsonb_array_elements(session_row.exercise_logs_json) LOOP
      IF log_row->>'exerciseId' IS NOT NULL AND log_row->>'exerciseId' != ''
         AND NOT EXISTS (SELECT 1 FROM user_exercises ue WHERE ue.id = (log_row->>'exerciseId')::uuid) THEN
        -- Find kept exercise via set_results (matched by exercise_order)
        SELECT sr.exercise_id INTO kept_id
        FROM set_results sr
        WHERE sr.session_id = session_row.id
          AND sr.exercise_order = (log_row->>'order')::int
          AND EXISTS (SELECT 1 FROM user_exercises ue WHERE ue.id = sr.exercise_id)
        LIMIT 1;
        IF kept_id IS NOT NULL THEN
          new_log = jsonb_set(log_row, '{exerciseId}', to_jsonb(kept_id::text));
          new_logs = new_logs || new_log;
        ELSE
          -- No mapping found — keep the log but with empty exerciseId
          new_log = jsonb_set(log_row, '{exerciseId}', to_jsonb(''));
          new_logs = new_logs || new_log;
          RAISE NOTICE 'Unmapped exercise % in session %', log_row->>'exerciseId', session_row.id;
        END IF;
        kept_id = NULL;
      ELSE
        new_logs = new_logs || log_row;
      END IF;
    END LOOP;
    UPDATE workout_sessions SET exercise_logs_json = new_logs
    WHERE id = session_row.id;
  END LOOP;
END $$;
