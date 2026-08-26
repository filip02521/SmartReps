-- Sync fixes: full rest timer JSON, max_tests dedup, NOT NULL user_id

alter table active_workout_state
  add column if not exists rest_timer_json jsonb;

update workout_sessions set user_id = (
  select user_id from program_progress pp where pp.program = workout_sessions.program limit 1
) where user_id is null;

update max_tests set user_id = (
  select user_id from program_progress pp where pp.program = max_tests.program limit 1
) where user_id is null;

alter table workout_sessions alter column user_id set not null;
alter table max_tests alter column user_id set not null;

create unique index if not exists max_tests_user_program_tested_at
  on max_tests (user_id, program, tested_at);
