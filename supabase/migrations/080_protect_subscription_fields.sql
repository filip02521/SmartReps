-- 080_protect_subscription_fields.sql
-- Close the self-upgrade hole: RLS "profiles_own" (auth.uid() = id, FOR ALL)
-- lets an authenticated user UPDATE their own profile row — including
-- subscription_status / subscription_expires_at / trial_started_at. Anyone
-- could self-grant 'lifetime' with a plain PostgREST call.
--
-- Column-level REVOKE can't fix this (the table-level UPDATE grant covers
-- every column), so we guard with a trigger: end-user roles may never write
-- the subscription columns, while privileged contexts pass:
--   - SECURITY DEFINER RPCs (start_trial, ...) run as the function owner
--   - service_role (Stripe webhook, admin) runs as 'service_role'
-- The trigger function is SECURITY INVOKER on purpose — inside a definer
-- function current_user becomes the owner and the check would be void.
--
-- Also drops the client INSERT path on subscription_events: the policy only
-- checked auth.uid() = user_id, so anyone could forge audit rows. Events are
-- written exclusively by definer RPCs / service role, which bypass RLS.

create or replace function public.protect_subscription_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      -- A fresh profile must be born 'free' — otherwise a first-sign-in
      -- insert could pre-set subscription_status = 'lifetime'.
      if new.subscription_status <> 'free'
         or new.subscription_expires_at is not null
         or new.trial_started_at is not null then
        raise exception 'subscription_fields_readonly';
      end if;
    elsif new.subscription_status is distinct from old.subscription_status
       or new.subscription_expires_at is distinct from old.subscription_expires_at
       or new.trial_started_at is distinct from old.trial_started_at then
      raise exception 'subscription_fields_readonly';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_subscription_fields on public.profiles;
create trigger profiles_protect_subscription_fields
  before insert or update on public.profiles
  for each row execute function public.protect_subscription_fields();

-- subscription_events: audit rows come only from definer RPCs (owner role,
-- bypasses RLS as table owner) or service_role (bypasses RLS entirely).
-- Dropping this policy removes the direct authenticated-insert path.
drop policy if exists subscription_events_service_insert on public.subscription_events;
