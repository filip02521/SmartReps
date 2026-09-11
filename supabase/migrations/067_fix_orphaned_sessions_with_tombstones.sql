-- Fix: 2 session_tombstones point to sessions that still exist in workout_sessions.
-- These sessions were deleted locally (tombstone created) but the cloud row was never removed,
-- creating a resurrection risk where another device could push the session back.
-- Solution: delete the orphaned sessions (and cascade set_results), tombstones remain as proof of deletion.

DELETE FROM workout_sessions
WHERE id IN (
  '6dd757a6-77f8-4b5b-8c45-afb521943121'::uuid,
  'd6e0583e-4214-4c21-8aa5-ecb4fe66f258'::uuid
);
