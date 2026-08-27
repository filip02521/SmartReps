-- Private config for Edge Function secrets when Dashboard/CLI secrets unavailable.
-- Only service_role can read (bypasses RLS; grants revoked from anon/authenticated).

create schema if not exists private;

create table if not exists private.push_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on schema private from public, anon, authenticated;
revoke all on private.push_config from public, anon, authenticated;
grant usage on schema private to service_role;
grant select, insert, update, delete on private.push_config to service_role;

comment on table private.push_config is
  'Web Push / cron secrets for send-workout-reminders (service_role only)';
