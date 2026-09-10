-- 064_fix_challenge_function_security.sql
-- Fix search_path warnings from advisor and tighten anon grants

-- Add search_path to helper functions
create or replace function weekly_challenge_week_key(d timestamptz default now())
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  adjusted timestamptz;
  year_start timestamptz;
  week_num int;
  yr int;
begin
  adjusted := d + interval '3 days' - (extract(dow from d)::int || ' days')::interval;
  yr := extract(year from adjusted)::int;
  year_start := to_date(yr::text || '-01-04', 'YYYY-MM-DD')::timestamptz;
  week_num := ceil((extract(doy from adjusted)::int + extract(dow from year_start)::int - 1) / 7.0);
  return yr::text || '-W' || lpad(week_num::text, 2, '0');
end;
$$;

create or replace function weekly_challenge_week_start(d timestamptz default now())
returns timestamptz
language plpgsql
immutable
set search_path = public
as $$
declare
  dow int;
begin
  dow := extract(dow from d)::int;
  if dow = 0 then
    return date_trunc('day', d) - interval '6 days';
  else
    return date_trunc('day', d) - ((dow - 1)::text || ' days')::interval;
  end if;
end;
$$;

-- Revoke anon execute on submit_challenge_progress (requires authentication)
revoke execute on function submit_challenge_progress(uuid, int, text) from anon;
grant execute on function submit_challenge_progress(uuid, int, text) to authenticated;
