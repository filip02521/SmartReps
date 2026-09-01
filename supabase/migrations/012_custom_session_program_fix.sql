-- Fix custom sessions + set_results upsert alignment (post-011)

-- Allow program = 'custom' for multi-exercise sessions (program_kind remains source of truth)
alter table workout_sessions drop constraint if exists workout_sessions_program_check;
alter table workout_sessions
  add constraint workout_sessions_program_check
  check (program in ('pushups', 'pullups', 'custom'));

-- Ensure exercise_order defaults for legacy rows
update set_results set exercise_order = 0 where exercise_order is null;
