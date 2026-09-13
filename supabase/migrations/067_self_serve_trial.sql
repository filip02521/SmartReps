-- 067_self_serve_trial.sql
-- Self-serve 14-day trial — works without Stripe so users can taste Pro
-- before billing lands. One-time per account (trial_started_at is the
-- permanent marker — an 'expired' or lapsed status never resets it).
--
-- Security: SECURITY DEFINER but strictly scoped — writes only the
-- caller's own profile row (auth.uid()), row lock prevents double-start
-- races, and the function refuses when the trial was already used or the
-- user already has Pro/trial/lifetime access.

create or replace function start_trial()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  prof record;
  trial_start timestamptz := now();
  trial_end timestamptz := now() + interval '14 days';
begin
  if uid is null then
    return jsonb_build_object('error', 'not_authenticated');
  end if;

  -- Lock the caller's row — two concurrent calls must not both start.
  select subscription_status, trial_started_at
    into prof
    from profiles
   where id = uid
     for update;

  if not found then
    return jsonb_build_object('error', 'profile_not_found');
  end if;

  -- trial_started_at is the permanent "trial consumed" marker.
  if prof.trial_started_at is not null then
    return jsonb_build_object('error', 'trial_already_used');
  end if;

  if prof.subscription_status in ('pro', 'lifetime', 'trial') then
    return jsonb_build_object('error', 'already_pro');
  end if;

  update profiles
     set subscription_status = 'trial',
         trial_started_at = trial_start,
         subscription_expires_at = trial_end
   where id = uid;

  insert into subscription_events (user_id, event_type, metadata)
  values (
    uid,
    'trial_started',
    jsonb_build_object('source', 'self_serve', 'trial_days', 14)
  );

  return jsonb_build_object(
    'status', 'trial',
    'expires_at', trial_end,
    'trial_started_at', trial_start
  );
end;
$$;

-- Authenticated users only — anon has no profile row to trial anyway.
revoke all on function start_trial() from public, anon;
grant execute on function start_trial() to authenticated;
