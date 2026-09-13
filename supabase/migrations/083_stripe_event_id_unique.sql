-- Migration 083: Enforce Stripe webhook idempotency.
-- recordEvent() already suppresses duplicate inserts for the same
-- stripe_event_id, but without a unique constraint two concurrently
-- processed events (e.g. checkout.session.completed + subscription.created
-- arriving together) could both pass the existence check and insert.
-- A partial unique index makes the dedupe atomic.
create unique index if not exists subscription_events_stripe_event_id_key
  on public.subscription_events (stripe_event_id)
  where stripe_event_id is not null;

-- The webhook now also records 'payment_failed' (async payment failure) —
-- extend the event_type allowlist.
alter table public.subscription_events
  drop constraint if exists subscription_events_event_type_check;
alter table public.subscription_events
  add constraint subscription_events_event_type_check check (
    event_type = any (array[
      'trial_started',
      'trial_expired',
      'subscription_created',
      'subscription_renewed',
      'subscription_canceled',
      'subscription_past_due',
      'subscription_expired',
      'subscription_pending',
      'lifetime_purchased',
      'payment_pending',
      'payment_failed'
    ])
  );
