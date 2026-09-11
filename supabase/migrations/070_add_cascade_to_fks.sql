-- Add ON DELETE CASCADE to FKs that reference profiles(id) and workout_sessions(id)
-- without cascade. When a user is deleted from auth.users, profiles row is cascade-deleted,
-- and these dependent rows should also be cleaned up (not left as orphans or block deletion).

-- workout_sessions.user_id → profiles(id)
ALTER TABLE workout_sessions
  DROP CONSTRAINT workout_sessions_user_id_fkey,
  ADD CONSTRAINT workout_sessions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- program_progress.user_id → profiles(id)
ALTER TABLE program_progress
  DROP CONSTRAINT program_progress_user_id_fkey,
  ADD CONSTRAINT program_progress_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- max_tests.user_id → profiles(id)
ALTER TABLE max_tests
  DROP CONSTRAINT max_tests_user_id_fkey,
  ADD CONSTRAINT max_tests_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- body_weight_entries.user_id → profiles(id)
ALTER TABLE body_weight_entries
  DROP CONSTRAINT body_weight_entries_user_id_fkey,
  ADD CONSTRAINT body_weight_entries_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- active_workout_state.user_id → profiles(id)
ALTER TABLE active_workout_state
  DROP CONSTRAINT active_workout_state_user_id_fkey,
  ADD CONSTRAINT active_workout_state_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- active_workout_state.session_id → workout_sessions(id)
ALTER TABLE active_workout_state
  DROP CONSTRAINT active_workout_state_session_id_fkey,
  ADD CONSTRAINT active_workout_state_session_id_fkey
    FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE;
