-- 065_tombstone_update_rls.sql
-- Add UPDATE policies for tombstone tables.
--
-- Upsert with onConflict (INSERT ... ON CONFLICT DO UPDATE) requires
-- UPDATE permission when the row already exists. Without an UPDATE
-- policy, RLS denies the upsert with 403 after the first sync creates
-- the row. This affected custom_plan_tombstones, exercise_tombstones,
-- and body_weight_tombstones — all used in upsert sync paths.

-- custom_plan_tombstones
drop policy if exists "users update own custom plan tombstones" on public.custom_plan_tombstones;
create policy "users update own custom plan tombstones"
  on public.custom_plan_tombstones for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- exercise_tombstones
drop policy if exists "users update own exercise tombstones" on public.exercise_tombstones;
create policy "users update own exercise tombstones"
  on public.exercise_tombstones for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- body_weight_tombstones
drop policy if exists "users update own body weight tombstones" on public.body_weight_tombstones;
create policy "users update own body weight tombstones"
  on public.body_weight_tombstones for update
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
