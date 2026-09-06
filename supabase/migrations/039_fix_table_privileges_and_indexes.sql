-- 039_fix_table_privileges_and_indexes.sql
-- 1. Revoke INSERT/UPDATE/DELETE on weekly_challenges from client roles (service_role only)
-- 2. Revoke TRUNCATE, REFERENCES, TRIGGER from all new tables (client roles shouldn't have these)
-- 3. Add missing FK index on weekly_challenge_entries(user_id)

-- 1. weekly_challenges: only service_role should write (admin table)
revoke insert, update, delete on weekly_challenges from anon, authenticated;

-- 2. Revoke TRUNCATE, REFERENCES, TRIGGER from all new tables
revoke truncate on community_reviews from anon, authenticated;
revoke references on community_reviews from anon, authenticated;
revoke trigger on community_reviews from anon, authenticated;

revoke truncate on weekly_challenges from anon, authenticated;
revoke references on weekly_challenges from anon, authenticated;
revoke trigger on weekly_challenges from anon, authenticated;

revoke truncate on weekly_challenge_entries from anon, authenticated;
revoke references on weekly_challenge_entries from anon, authenticated;
revoke trigger on weekly_challenge_entries from anon, authenticated;

revoke truncate on public_profiles from anon, authenticated;
revoke references on public_profiles from anon, authenticated;
revoke trigger on public_profiles from anon, authenticated;

revoke truncate on user_follows from anon, authenticated;
revoke references on user_follows from anon, authenticated;
revoke trigger on user_follows from anon, authenticated;

-- 3. Add missing FK index
create index if not exists weekly_challenge_entries_user_id_idx
  on weekly_challenge_entries(user_id);
