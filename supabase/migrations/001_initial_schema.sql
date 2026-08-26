-- SmartReps Supabase schema

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  theme_preference text default 'system',
  created_at timestamptz default now()
);

create table if not exists program_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  program text not null check (program in ('pushups', 'pullups')),
  cycle_id text not null,
  current_day int not null default 1,
  status text not null default 'active'
    check (status in ('active', 'rest', 'test_pending', 'cycle_failed', 'paused')),
  cycle_attempt int default 1,
  last_workout_at timestamptz,
  next_workout_after timestamptz,
  started_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, program)
);

create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  program text not null,
  cycle_id text not null,
  day_number int not null,
  cycle_attempt int not null,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned')),
  started_at timestamptz not null,
  completed_at timestamptz,
  passed boolean,
  total_reps int,
  notes text
);

create table if not exists active_workout_state (
  user_id uuid references profiles not null,
  program text not null,
  session_id uuid references workout_sessions not null,
  current_set int not null default 1,
  set_results_json jsonb not null default '[]',
  rest_started_at timestamptz,
  updated_at timestamptz default now(),
  primary key (user_id, program)
);

create table if not exists set_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references workout_sessions not null,
  set_number int not null check (set_number between 1 and 9),
  target_kind text not null,
  target_reps int,
  min_reps int,
  actual_reps int not null,
  passed boolean not null
);

create table if not exists max_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles,
  program text not null,
  reps int not null,
  tested_at timestamptz default now(),
  selected_cycle_id text not null,
  was_manual_override boolean default false
);

create index if not exists idx_workout_sessions_user on workout_sessions(user_id, program, started_at desc);

alter table profiles enable row level security;
alter table program_progress enable row level security;
alter table workout_sessions enable row level security;
alter table active_workout_state enable row level security;
alter table set_results enable row level security;
alter table max_tests enable row level security;

create policy "profiles_own" on profiles for all using (auth.uid() = id);
create policy "progress_own" on program_progress for all using (auth.uid() = user_id);
create policy "sessions_own" on workout_sessions for all using (auth.uid() = user_id);
create policy "active_own" on active_workout_state for all using (auth.uid() = user_id);
create policy "sets_own" on set_results for all using (
  session_id in (select id from workout_sessions where user_id = auth.uid())
);
create policy "tests_own" on max_tests for all using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
