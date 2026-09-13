-- 091_expire_lapsed_subscriptions.sql
-- Truth-in-status sweeper: enforcement already keys off
-- subscription_expires_at (every pro gate checks `expires_at > now()`),
-- so a lapsed row is harmless — but it keeps subscription_status='pro'
-- forever, which skews analytics and blocks the one-time self-serve
-- trial for users whose grant simply ran out.
--
-- expire_lapsed_subscriptions() flips lapsed 'pro'/'trial' rows to
-- 'expired' and writes a subscription_expired audit event per user.
-- Idempotent, single statement, safe to run on every cron tick.
--
-- Rows with expires_at IS NULL are left untouched — null means "active
-- indefinitely" by contract across all gates (defensive default).
--
-- Called from the hourly send-workout-reminders cron (service_role).
-- End-user roles get no EXECUTE — same posture as the other
-- trigger/admin helpers hardened in 089.

create or replace function public.expire_lapsed_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  flipped integer;
begin
  -- FOR UPDATE inside the CTE serializes concurrent sweeps; a second
  -- caller sees the post-flip rows and matches nothing.
  with lapsed as (
    select id, subscription_status as prev_status
    from profiles
    where subscription_status in ('pro', 'trial')
      and subscription_expires_at is not null
      and subscription_expires_at <= now()
    for update
  ), flipped_rows as (
    update profiles p
       set subscription_status = 'expired'
      from lapsed l
     where p.id = l.id
    returning p.id
  ), events as (
    insert into subscription_events (user_id, event_type, metadata)
    select l.id,
           'subscription_expired',
           jsonb_build_object('source', 'sweeper', 'previous_status', l.prev_status)
      from lapsed l
    returning user_id
  )
  select count(*) into flipped from flipped_rows;
  return flipped;
end;
$$;

revoke all on function public.expire_lapsed_subscriptions() from public, anon, authenticated;
grant execute on function public.expire_lapsed_subscriptions() to service_role;
