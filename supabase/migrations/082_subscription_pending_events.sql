-- 082_subscription_pending_events.sql
-- Allow 'payment_pending' / 'subscription_pending' audit rows in
-- subscription_events. The stripe-webhook writes these when a checkout
-- completes but money hasn't landed yet (async payment methods like
-- Przelewy24/BLIK/bank transfer, or a subscription stuck in 'incomplete'
-- after a failed first invoice) — entitlement is NOT granted, but the
-- event is recorded for audit and to explain why access is still absent.

alter table public.subscription_events
  drop constraint if exists subscription_events_event_type_check;

alter table public.subscription_events
  add constraint subscription_events_event_type_check
  check (event_type in (
    'trial_started', 'trial_expired',
    'subscription_created', 'subscription_renewed', 'subscription_canceled',
    'subscription_past_due', 'subscription_expired', 'subscription_pending',
    'lifetime_purchased', 'payment_pending'
  ));
