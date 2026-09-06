-- Tombstones for custom plans, exercises, and body-weight entries.
-- Prevents deleted records from being resurrected by cross-device sync.

create table if not exists public.custom_plan_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);

create table if not exists public.exercise_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

create table if not exists public.body_weight_tombstones (
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_id text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, entry_id)
);

alter table public.custom_plan_tombstones enable row level security;
alter table public.exercise_tombstones enable row level security;
alter table public.body_weight_tombstones enable row level security;

create policy "users select own custom plan tombstones"
  on public.custom_plan_tombstones for select
  using (auth.uid() = user_id);

create policy "users insert own custom plan tombstones"
  on public.custom_plan_tombstones for insert
  with check (auth.uid() = user_id);

create policy "users delete own custom plan tombstones"
  on public.custom_plan_tombstones for delete
  using (auth.uid() = user_id);

create policy "users select own exercise tombstones"
  on public.exercise_tombstones for select
  using (auth.uid() = user_id);

create policy "users insert own exercise tombstones"
  on public.exercise_tombstones for insert
  with check (auth.uid() = user_id);

create policy "users delete own exercise tombstones"
  on public.exercise_tombstones for delete
  using (auth.uid() = user_id);

create policy "users select own body weight tombstones"
  on public.body_weight_tombstones for select
  using (auth.uid() = user_id);

create policy "users insert own body weight tombstones"
  on public.body_weight_tombstones for insert
  with check (auth.uid() = user_id);

create policy "users delete own body weight tombstones"
  on public.body_weight_tombstones for delete
  using (auth.uid() = user_id);
