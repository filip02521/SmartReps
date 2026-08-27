-- Push secrets readable by Edge Function (service_role).
-- RLS enabled with no policies → anon/authenticated denied; service_role bypasses RLS.

create table if not exists public.push_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.push_config enable row level security;

revoke all on public.push_config from anon, authenticated;
grant select, insert, update, delete on public.push_config to service_role;

-- Optional: copy from private.push_config if migration 008 already ran
do $$
begin
  if to_regclass('private.push_config') is not null then
    insert into public.push_config (key, value, updated_at)
    select key, value, updated_at from private.push_config
    on conflict (key) do update
      set value = excluded.value, updated_at = excluded.updated_at;
  end if;
end $$;

comment on table public.push_config is
  'Web Push secrets for Edge Function; RLS on, no policies — service_role only';
