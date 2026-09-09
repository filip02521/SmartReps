-- 056: Fix body-weight resurrection + orphan set_results on session delete
--
-- Problem 1: body_weight_entries.id defaults to gen_random_uuid() in Postgres,
-- but the client generates its own crypto.randomUUID() and stores a tombstone
-- keyed by that id. The upsert used onConflict(user_id, measured_at) WITHOUT
-- sending the local id, so Postgres generated a NEW id on re-insert. The
-- tombstone (keyed by the original local id) no longer matched → deleted
-- entries resurrected on cross-device sync.
--
-- Fix: make body_weight_entries.id a client-supplied uuid (no default) and
-- add a unique constraint on (user_id, id) so upsert on (user_id, id) works.
-- The (user_id, measured_at) unique index is kept for duplicate-prevention but
-- the conflict target for sync becomes (user_id, id).
--
-- Problem 2: deleting a workout_sessions row left child set_results orphaned
-- (no ON DELETE CASCADE). Add cascade so session deletes clean up children.

-- ── 1. Body-weight: client-supplied id ──
-- Drop the default so the client MUST supply id (it always does via crypto.randomUUID()).
alter table body_weight_entries
  alter column id drop default;

-- Unique constraint on (user_id, id) — enables upsert with onConflict: 'user_id,id'.
-- id is already the primary key (globally unique), but a composite unique index
-- lets Postgres use it as a conflict target for upserts filtered by user_id.
create unique index if not exists body_weight_entries_user_id_unique
  on body_weight_entries (user_id, id);

-- ── 2. set_results: cascade on session delete ──
-- Drop and recreate the FK with ON DELETE CASCADE so deleting a session row
-- (locally or via sync tombstone) cleans up its set_results.
alter table set_results
  drop constraint if exists set_results_session_id_fkey;

alter table set_results
  add constraint set_results_session_id_fkey
  foreign key (session_id) references workout_sessions(id) on delete cascade;
