-- 065_distinct_challenge_participants.sql
-- The dashboard previously summed per-challenge participant counts, which
-- counted the same user once per challenge they entered (up to 12×). This
-- RPC returns the number of DISTINCT users with entries in any currently
-- active weekly challenge.

create or replace function get_active_weekly_participant_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct e.user_id)::int
  from weekly_challenge_entries e
  join weekly_challenges c on c.id = e.challenge_id
  where c.is_active
    and c.starts_at <= now()
    and c.ends_at > now();
$$;

grant execute on function get_active_weekly_participant_count() to authenticated, anon;
