-- 081_stripe_customer_id.sql
-- Stripe integration plumbing: store the Stripe customer id on the profile so
-- the Customer Portal function can resolve it without a lookup. Written only
-- by the stripe-webhook Edge Function (service role) — added to the
-- protect_subscription_fields trigger because a user who could set this
-- column could point the portal at ANOTHER customer's billing account.

alter table profiles
  add column if not exists stripe_customer_id text;

create index if not exists profiles_stripe_customer_idx
  on profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- Extend the column guard from 080 with stripe_customer_id.
-- SECURITY INVOKER is required: inside a definer function current_user
-- becomes the owner and the role check would never fire.
create or replace function public.protect_subscription_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      if new.subscription_status <> 'free'
         or new.subscription_expires_at is not null
         or new.trial_started_at is not null
         or new.stripe_customer_id is not null then
        raise exception 'subscription_fields_readonly';
      end if;
    elsif new.subscription_status is distinct from old.subscription_status
       or new.subscription_expires_at is distinct from old.subscription_expires_at
       or new.trial_started_at is distinct from old.trial_started_at
       or new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'subscription_fields_readonly';
    end if;
  end if;
  return new;
end;
$$;
