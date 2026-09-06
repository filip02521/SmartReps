-- ═══════════════════════════════════════════════════════════════
-- 042: Fix advisor warnings — RLS initplan optimization + FK indexes
--
-- 1. auth_rls_initplan: wrap auth.uid() in (select ...) subquery
--    Prevents re-evaluation of auth.uid() for each row in RLS policies.
--    Affects: profiles, program_progress, workout_sessions, active_workout_state,
--    active_custom_workout_state, ai_insights, body_weight_entries, body_weight_tombstones,
--    custom_plans, custom_program_progress, custom_plan_tombstones, max_tests,
--    exercise_tombstones, session_tombstones, push_subscriptions, user_exercises,
--    user_achievements, community_imports, community_likes, community_reports,
--    community_reviews, community_publications, public_profiles, user_follows,
--    weekly_challenge_entries, set_results.
--
-- 2. Unindexed foreign keys: add covering indexes for FK columns.
--
-- NOTE: push_config RLS enabled no policy — INTENTIONAL (service_role only,
-- no anon/authenticated grants). Advisor is a false positive here.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. RLS initplan optimization: replace auth.uid() with (select auth.uid()) ──

-- profiles
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles
  for all using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- program_progress
drop policy if exists progress_own on public.program_progress;
create policy progress_own on public.program_progress
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- workout_sessions
drop policy if exists sessions_own on public.workout_sessions;
create policy sessions_own on public.workout_sessions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- active_workout_state
drop policy if exists active_own on public.active_workout_state;
create policy active_own on public.active_workout_state
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- active_custom_workout_state
drop policy if exists active_custom_workout_own on public.active_custom_workout_state;
create policy active_custom_workout_own on public.active_custom_workout_state
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ai_insights
drop policy if exists ai_insights_owner on public.ai_insights;
create policy ai_insights_owner on public.ai_insights
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- body_weight_entries
drop policy if exists body_weight_own on public.body_weight_entries;
create policy body_weight_own on public.body_weight_entries
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- body_weight_tombstones
drop policy if exists "users select own body weight tombstones" on public.body_weight_tombstones;
create policy "users select own body weight tombstones" on public.body_weight_tombstones
  for select using ((select auth.uid()) = user_id);
drop policy if exists "users delete own body weight tombstones" on public.body_weight_tombstones;
create policy "users delete own body weight tombstones" on public.body_weight_tombstones
  for delete using ((select auth.uid()) = user_id);

-- custom_plans
drop policy if exists custom_plans_own on public.custom_plans;
create policy custom_plans_own on public.custom_plans
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- custom_program_progress
drop policy if exists custom_program_progress_own on public.custom_program_progress;
create policy custom_program_progress_own on public.custom_program_progress
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- custom_plan_tombstones
drop policy if exists "users select own custom plan tombstones" on public.custom_plan_tombstones;
create policy "users select own custom plan tombstones" on public.custom_plan_tombstones
  for select using ((select auth.uid()) = user_id);
drop policy if exists "users delete own custom plan tombstones" on public.custom_plan_tombstones;
create policy "users delete own custom plan tombstones" on public.custom_plan_tombstones
  for delete using ((select auth.uid()) = user_id);

-- max_tests
drop policy if exists tests_own on public.max_tests;
create policy tests_own on public.max_tests
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- exercise_tombstones
drop policy if exists "users select own exercise tombstones" on public.exercise_tombstones;
create policy "users select own exercise tombstones" on public.exercise_tombstones
  for select using ((select auth.uid()) = user_id);
drop policy if exists "users delete own exercise tombstones" on public.exercise_tombstones;
create policy "users delete own exercise tombstones" on public.exercise_tombstones
  for delete using ((select auth.uid()) = user_id);

-- session_tombstones
drop policy if exists session_tombstones_owner on public.session_tombstones;
create policy session_tombstones_owner on public.session_tombstones
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- push_subscriptions
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- user_exercises
drop policy if exists user_exercises_own on public.user_exercises;
create policy user_exercises_own on public.user_exercises
  for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- user_achievements
drop policy if exists user_achievements_select on public.user_achievements;
create policy user_achievements_select on public.user_achievements
  for select using ((select auth.uid()) = user_id);
drop policy if exists user_achievements_update on public.user_achievements;
create policy user_achievements_update on public.user_achievements
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists user_achievements_delete on public.user_achievements;
create policy user_achievements_delete on public.user_achievements
  for delete using ((select auth.uid()) = user_id);

-- community_imports
drop policy if exists community_imports_select_own on public.community_imports;
create policy community_imports_select_own on public.community_imports
  for select using (user_id = (select auth.uid()));

-- community_likes
drop policy if exists community_likes_select_own on public.community_likes;
create policy community_likes_select_own on public.community_likes
  for select using (user_id = (select auth.uid()));

-- community_reports
drop policy if exists community_reports_select_own on public.community_reports;
create policy community_reports_select_own on public.community_reports
  for select using (reporter_id = (select auth.uid()));

-- community_reviews
drop policy if exists community_reviews_delete on public.community_reviews;
create policy community_reviews_delete on public.community_reviews
  for delete using (user_id = (select auth.uid()));
drop policy if exists community_reviews_update on public.community_reviews;
create policy community_reviews_update on public.community_reviews
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- community_publications
drop policy if exists community_publications_select on public.community_publications;
create policy community_publications_select on public.community_publications
  for select using ((status = 'published') OR (author_id = (select auth.uid())));

-- public_profiles
drop policy if exists public_profiles_select on public.public_profiles;
create policy public_profiles_select on public.public_profiles
  for select using ((is_public = true) OR (user_id = (select auth.uid())));
drop policy if exists public_profiles_update on public.public_profiles;
create policy public_profiles_update on public.public_profiles
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- user_follows
drop policy if exists user_follows_delete on public.user_follows;
create policy user_follows_delete on public.user_follows
  for delete using (follower_id = (select auth.uid()));

-- weekly_challenge_entries
drop policy if exists weekly_challenge_entries_delete on public.weekly_challenge_entries;
create policy weekly_challenge_entries_delete on public.weekly_challenge_entries
  for delete using (user_id = (select auth.uid()));
drop policy if exists weekly_challenge_entries_update on public.weekly_challenge_entries;
create policy weekly_challenge_entries_update on public.weekly_challenge_entries
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- set_results — uses subquery on workout_sessions, wrap auth.uid() there too
drop policy if exists sets_own on public.set_results;
create policy sets_own on public.set_results
  for all using (session_id IN (
    SELECT ws.id FROM public.workout_sessions ws
    WHERE ws.user_id = (select auth.uid())
  ));

-- ── 2. Unindexed foreign keys — add covering indexes ──

create index if not exists active_custom_workout_state_custom_plan_id_idx
  on public.active_custom_workout_state(custom_plan_id);

create index if not exists active_workout_state_session_id_idx
  on public.active_workout_state(session_id);

create index if not exists ai_insights_session_id_idx
  on public.ai_insights(session_id);

create index if not exists community_imports_user_id_idx
  on public.community_imports(user_id);

create index if not exists community_likes_user_id_idx
  on public.community_likes(user_id);

create index if not exists community_reports_reporter_id_idx
  on public.community_reports(reporter_id);

create index if not exists custom_program_progress_custom_plan_id_idx
  on public.custom_program_progress(custom_plan_id);

create index if not exists workout_sessions_custom_plan_id_idx
  on public.workout_sessions(custom_plan_id);
