-- ═══════════════════════════════════════════════════════════════
-- 043: Fix auth_rls_initplan on INSERT policies
-- Wraps auth.uid() in (select ...) subquery in with_check expressions.
-- ═══════════════════════════════════════════════════════════════

-- body_weight_tombstones
drop policy if exists "users insert own body weight tombstones" on public.body_weight_tombstones;
create policy "users insert own body weight tombstones" on public.body_weight_tombstones
  for insert with check ((select auth.uid()) = user_id);

-- community_reviews
drop policy if exists community_reviews_insert on public.community_reviews;
create policy community_reviews_insert on public.community_reviews
  for insert with check ((user_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM community_publications p
  WHERE ((p.id = community_reviews.publication_id) AND (p.status = 'published') AND (p.author_id <> (select auth.uid()))))));

-- custom_plan_tombstones
drop policy if exists "users insert own custom plan tombstones" on public.custom_plan_tombstones;
create policy "users insert own custom plan tombstones" on public.custom_plan_tombstones
  for insert with check ((select auth.uid()) = user_id);

-- exercise_tombstones
drop policy if exists "users insert own exercise tombstones" on public.exercise_tombstones;
create policy "users insert own exercise tombstones" on public.exercise_tombstones
  for insert with check ((select auth.uid()) = user_id);

-- public_profiles
drop policy if exists public_profiles_insert on public.public_profiles;
create policy public_profiles_insert on public.public_profiles
  for insert with check (user_id = (select auth.uid()));

-- user_achievements
drop policy if exists user_achievements_upsert on public.user_achievements;
create policy user_achievements_upsert on public.user_achievements
  for insert with check ((select auth.uid()) = user_id);

-- user_follows
drop policy if exists user_follows_insert on public.user_follows;
create policy user_follows_insert on public.user_follows
  for insert with check ((follower_id = (select auth.uid())) AND (EXISTS ( SELECT 1
   FROM public_profiles
  WHERE ((public_profiles.user_id = user_follows.followee_id) AND (public_profiles.is_public = true)))));

-- weekly_challenge_entries
drop policy if exists weekly_challenge_entries_insert on public.weekly_challenge_entries;
create policy weekly_challenge_entries_insert on public.weekly_challenge_entries
  for insert with check (user_id = (select auth.uid()));
