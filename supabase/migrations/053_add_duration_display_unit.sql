-- 053: Add duration_display_unit column to user_exercises
-- Allows cardio exercises to display/log duration in minutes instead of seconds.
-- Values: 'sec' (default, backward compatible) or 'min'.
-- Only meaningful when primary_metric = 'duration_sec'.

alter table public.user_exercises
  add column if not exists duration_display_unit text default 'sec'
  check (duration_display_unit in ('sec', 'min'));

comment on column public.user_exercises.duration_display_unit is
  'Display unit for duration_sec exercises: sec (default) or min. When min, UI shows/accepts minutes and converts to seconds internally.';

-- Backfill: set duration_display_unit = 'min' for existing cardio exercises
update public.user_exercises
  set duration_display_unit = 'min'
  where primary_metric = 'duration_sec'
    and muscle_group = 'cardio'
    and duration_display_unit is null;
