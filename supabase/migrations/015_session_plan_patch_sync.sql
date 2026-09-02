-- Sync mid-workout plan edits + summary patch / progression diff across devices

alter table workout_sessions
  add column if not exists session_day_patch_json jsonb,
  add column if not exists progression_diff_json jsonb;

alter table active_custom_workout_state
  add column if not exists day_override_json jsonb,
  add column if not exists amrap_end_at bigint,
  add column if not exists amrap_group_id text;
