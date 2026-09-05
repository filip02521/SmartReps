-- 026_missing_columns.sql
-- Columns referenced in application code but missing from migrations.
-- Found during sync audit (cross-device consistency review).
--
-- NOTE: profiles.weight_unit, profiles.high_contrast, profiles.language,
-- and user_exercises.muscle_group were already applied to Supabase
-- via earlier ad-hoc migrations (add_weight_unit_and_high_contrast_to_profiles,
-- add_language_to_profiles, add_muscle_group_to_user_exercises).
-- This file documents them for repo completeness but uses IF NOT EXISTS
-- so it's safe to run on databases that already have them.

-- ── profiles: weight_unit, high_contrast, language ──
-- These are synced in src/lib/sync.ts upsertProfile + pullProfileEnabledPrograms
-- and merged in mergeUiSettingsFromProfile, but were never in a numbered migration.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight_unit text NOT NULL DEFAULT 'kg';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS high_contrast boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pl';

-- ── user_exercises: muscle_group ──
-- Referenced in src/lib/custom-sync.ts upsertUserExercise payload.
ALTER TABLE public.user_exercises ADD COLUMN IF NOT EXISTS muscle_group text;

-- ── push_subscriptions: enabled, keys ──
-- Referenced in supabase/functions/send-weekly-report/index.ts (.eq('enabled', true) + select keys)
-- 'keys' stores the full Web Push subscription keys object for edge functions that need it.
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS keys jsonb;
