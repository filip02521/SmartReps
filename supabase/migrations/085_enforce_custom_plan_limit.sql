-- 085_enforce_custom_plan_limit.sql
-- Close the client-side-only custom plan limit bypass: FREE_CUSTOM_PLAN_LIMIT
-- is enforced in feature-gating.ts (canCreateCustomPlan), but a free user could
-- bypass it by directly calling the Supabase REST API to INSERT into custom_plans
-- (the table has a FOR ALL RLS policy). This trigger enforces the same limit
-- server-side: a non-Pro user may not have more than 3 custom plans.
--
-- Pro/trial/lifetime users are unlimited. The check runs BEFORE INSERT and
-- counts existing active plans for the same user. SECURITY INVOKER so the
-- check fires for authenticated/anon roles; service_role bypasses RLS but
-- the trigger still fires — we explicitly exempt service_role.

create or replace function public.enforce_custom_plan_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_count int;
  is_pro boolean;
  profile_status text;
  profile_expires timestamptz;
begin
  -- service_role bypasses this check (Edge Functions, admin tools).
  if current_user = 'service_role' then
    return new;
  end if;

  -- Read the user's subscription status.
  select subscription_status, subscription_expires_at
    into profile_status, profile_expires
    from profiles
    where id = new.user_id;

  is_pro := profile_status = 'lifetime'
    or (profile_status in ('pro', 'trial')
        and (profile_expires is null or profile_expires > now()));

  if is_pro then
    return new;
  end if;

  -- Count existing custom plans for this user (excluding the one being
  -- inserted, in case of an upsert that conflicts on id).
  select count(*) into current_count
    from custom_plans
    where user_id = new.user_id
      and id is distinct from new.id;

  if current_count >= 3 then
    raise exception 'custom_plan_limit_exceeded';
  end if;

  return new;
end;
$$;

drop trigger if exists custom_plans_enforce_limit on public.custom_plans;
create trigger custom_plans_enforce_limit
  before insert on public.custom_plans
  for each row execute function public.enforce_custom_plan_limit();
