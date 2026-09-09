-- Dodaje 'squats' do constraintów CHECK na tabelach z programami.
-- Bez tego squats program nie może się synchronizować do chmury —
-- INSERT/UPDATE z program='squats' rzuci błąd constraint violation.

-- program_progress — oryginalny constraint z 001_initial_schema.sql
alter table public.program_progress
  drop constraint if exists program_progress_program_check;
alter table public.program_progress
  add constraint program_progress_program_check
  check (program in ('pushups', 'pullups', 'squats'));

-- workout_sessions — constraint z 012_custom_session_program_fix.sql
alter table public.workout_sessions
  drop constraint if exists workout_sessions_program_check;
alter table public.workout_sessions
  add constraint workout_sessions_program_check
  check (program in ('pushups', 'pullups', 'squats', 'custom'));

-- weekly_challenges — constraint z 032_weekly_challenge.sql
alter table public.weekly_challenges
  drop constraint if exists weekly_challenges_program_check;
alter table public.weekly_challenges
  add constraint weekly_challenges_program_check
  check (program in ('pushups', 'pullups', 'squats'));

-- profiles.enabled_programs — constraint z 005_profiles_enabled_programs.sql
-- Oryginalna nazwa: profiles_enabled_programs_valid
-- Oryginalny: enabled_programs <@ array['pushups', 'pullups']::text[]
-- Nowy: enabled_programs <@ array['pushups', 'pullups', 'squats']::text[]
alter table public.profiles
  drop constraint if exists profiles_enabled_programs_valid;
alter table public.profiles
  add constraint profiles_enabled_programs_valid
  check (
    enabled_programs <@ array['pushups', 'pullups', 'squats']::text[]
    and cardinality(enabled_programs) >= 1
  );
