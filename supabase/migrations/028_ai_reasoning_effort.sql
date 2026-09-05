-- 028_ai_reasoning_effort.sql
-- Sync the aiReasoningEffort preference across devices.
-- Controls reasoning/thinking depth for Gemini models: 'auto' (disable when possible), 'low', 'medium', 'high'.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_reasoning_effort text NOT NULL DEFAULT 'auto';
