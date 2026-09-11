-- Fix: user_exercises has 64 duplicate (user_id, name) pairs, all source='starter'.
-- Root cause: starter exercise seeding creates new UUIDs on every sync/app launch without checking for existing entries.
-- Solution:
--   1. Re-point set_results.exercise_id from duplicates to the kept (oldest) exercise
--   2. Delete all duplicate exercises (keep oldest per user_id+name)
--   3. Add UNIQUE constraint to prevent future duplicates

-- Step 1: Re-point set_results.exercise_id from duplicates to kept exercise
UPDATE set_results sr
SET exercise_id = kept.id
FROM (
  SELECT d.id AS dup_id, k.id AS keep_id
  FROM (
    SELECT id, user_id, name, created_at,
      ROW_NUMBER() OVER (PARTITION BY user_id, name ORDER BY created_at) AS rn
    FROM user_exercises
  ) d
  JOIN (
    SELECT id, user_id, name, created_at,
      ROW_NUMBER() OVER (PARTITION BY user_id, name ORDER BY created_at) AS rn
    FROM user_exercises
  ) k ON k.user_id = d.user_id AND k.name = d.name AND k.rn = 1
  WHERE d.rn > 1
) mapping
WHERE sr.exercise_id = mapping.dup_id;

-- Step 2: Delete duplicate exercises (keep oldest = rn = 1)
DELETE FROM user_exercises
WHERE id IN (
  SELECT id FROM (
    SELECT id, user_id, name, created_at,
      ROW_NUMBER() OVER (PARTITION BY user_id, name ORDER BY created_at) AS rn
    FROM user_exercises
  ) ranked
  WHERE rn > 1
);

-- Step 3: Add unique constraint to prevent future duplicates
ALTER TABLE user_exercises
  ADD CONSTRAINT user_exercises_user_id_name_key UNIQUE (user_id, name);
