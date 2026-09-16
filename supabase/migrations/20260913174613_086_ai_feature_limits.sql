-- 086: Per-feature AI daily caps
--
-- The global daily cap alone cannot bound cost: plan_generation requests are
-- ~10x more expensive than short insights, so a user scripting 60 generations
-- per day would cost more than a monthly subscription. ai_consume() gains an
-- optional per-feature limit and returns -2 when that cap is hit (global cap
-- still returns -1). The old 3-arg overload is dropped so no un-capped path
-- remains.

drop function if exists public.ai_consume(uuid, text, integer);

create or replace function public.ai_consume(
  p_user_id uuid,
  p_feature text,
  p_daily_limit integer,
  p_feature_limit integer default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_feature_count integer;
begin
  insert into ai_usage_daily (user_id, usage_date, call_count, features)
  values (p_user_id, current_date, 0, '{}'::jsonb)
  on conflict (user_id, usage_date) do nothing;

  select call_count, coalesce((features ->> p_feature)::integer, 0)
  into v_count, v_feature_count
  from ai_usage_daily
  where user_id = p_user_id and usage_date = current_date
  for update;

  if v_count >= p_daily_limit then
    return -1;
  end if;
  if p_feature_limit is not null and v_feature_count >= p_feature_limit then
    return -2;
  end if;

  update ai_usage_daily
  set
    call_count = call_count + 1,
    features = jsonb_set(
      features,
      array[p_feature],
      to_jsonb(v_feature_count + 1)
    ),
    updated_at = now()
  where user_id = p_user_id and usage_date = current_date;

  return v_count + 1;
end;
$$;

revoke all on function public.ai_consume(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_consume(uuid, text, integer, integer) to service_role;
