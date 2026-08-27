-- Sync enabled training programs between devices (last-write-wins via updated_at)

alter table profiles
  add column if not exists enabled_programs text[] not null default '{pushups}',
  add column if not exists enabled_programs_updated_at timestamptz not null default now();

alter table profiles
  drop constraint if exists profiles_enabled_programs_valid;

alter table profiles
  add constraint profiles_enabled_programs_valid
  check (
    enabled_programs <@ array['pushups', 'pullups']::text[]
    and cardinality(enabled_programs) >= 1
  );

-- Backfill from existing program_progress rows
update profiles p
set
  enabled_programs = coalesce(
    (
      select array_agg(distinct pp.program order by pp.program)
      from program_progress pp
      where pp.user_id = p.id
    ),
    '{pushups}'::text[]
  ),
  enabled_programs_updated_at = now()
where exists (select 1 from program_progress pp where pp.user_id = p.id);
