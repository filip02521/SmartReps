-- Resume state for custom multi-exercise workouts (cross-device sync)

create table if not exists active_custom_workout_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  custom_plan_id uuid not null references custom_plans(id) on delete cascade,
  session_id uuid not null,
  current_exercise_index int not null default 0 check (current_exercise_index >= 0),
  current_set_index int not null default 0 check (current_set_index >= 0),
  exercise_logs_json jsonb not null default '[]',
  rest_timer_json jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, custom_plan_id)
);

create index if not exists active_custom_workout_user_updated
  on active_custom_workout_state (user_id, updated_at desc);

alter table active_custom_workout_state enable row level security;

create policy active_custom_workout_own on active_custom_workout_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
