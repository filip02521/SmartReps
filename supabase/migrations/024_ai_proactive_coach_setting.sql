-- 024_ai_proactive_coach_setting.sql
-- Sync the aiProactiveCoach preference (not credentials) across devices.
-- aiApiKey, aiModel, aiBaseUrl remain local-only and are NOT synced.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_proactive_coach boolean NOT NULL DEFAULT false;
