-- Add display_started_at and failed_retry_used to active_workout_state
-- so the display-only timer (shifted by pause duration on resume) syncs across devices.
alter table active_workout_state
  add column if not exists display_started_at timestamptz,
  add column if not exists failed_retry_used boolean;

-- Add display_started_at to active_custom_workout_state for the same reason.
alter table active_custom_workout_state
  add column if not exists display_started_at timestamptz;
