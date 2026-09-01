-- Separate LWW clocks for custom home-card prefs (decoupled from builtin enabled_programs).

alter table profiles
  add column if not exists enabled_workouts_updated_at timestamptz,
  add column if not exists custom_plans_filter_explicit boolean not null default false;
