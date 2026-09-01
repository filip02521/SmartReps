-- Custom exercises & multi-exercise plans (Faza 0)

-- User exercise library
create table if not exists user_exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  primary_metric text not null check (primary_metric in ('reps', 'duration_sec', 'reps_weight')),
  rest_default_sec int not null default 90 check (rest_default_sec >= 0),
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_exercises_user_updated
  on user_exercises (user_id, updated_at desc);

alter table user_exercises enable row level security;

create policy user_exercises_own on user_exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Custom plans (plan body as jsonb)
create table if not exists custom_plans (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  status text not null check (status in ('draft', 'active')),
  source text not null default 'user' check (source in ('user', 'duplicate', 'import')),
  plan_json jsonb not null,
  progression_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists custom_plans_user_updated
  on custom_plans (user_id, updated_at desc);

alter table custom_plans enable row level security;

create policy custom_plans_own on custom_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Progress for custom plans (separate from builtin program_progress)
create table if not exists custom_program_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  custom_plan_id uuid not null references custom_plans(id) on delete cascade,
  current_day int not null default 1,
  status text not null check (status in ('active', 'rest', 'cycle_complete', 'paused')),
  cycle_attempt int not null default 1,
  last_workout_at timestamptz,
  next_workout_after timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, custom_plan_id)
);

alter table custom_program_progress enable row level security;

create policy custom_program_progress_own on custom_program_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Workout sessions: support custom plans
alter table workout_sessions
  add column if not exists program_kind text not null default 'builtin'
    check (program_kind in ('builtin', 'custom')),
  add column if not exists custom_plan_id uuid references custom_plans(id) on delete set null,
  add column if not exists exercise_logs_json jsonb;

alter table workout_sessions drop constraint if exists workout_sessions_program_check;
alter table workout_sessions
  add constraint workout_sessions_program_check
  check (program in ('pushups', 'pullups', 'custom'));

-- set_results: multi-exercise + duration/weight
alter table set_results
  add column if not exists exercise_id uuid,
  add column if not exists exercise_order int not null default 0,
  add column if not exists duration_sec int,
  add column if not exists weight_kg numeric(8, 2),
  add column if not exists metrics_json jsonb;

-- Drop old unique / set_number check for multi-exercise
drop index if exists set_results_session_set_number;

alter table set_results drop constraint if exists set_results_set_number_check;

alter table set_results
  add constraint set_results_set_number_check
  check (set_number between 1 and 30);

create unique index if not exists set_results_session_exercise_set
  on set_results (session_id, exercise_order, set_number);

-- Optional enabled custom workouts on profile (Faza 4)
alter table profiles
  add column if not exists enabled_workouts_json jsonb;
