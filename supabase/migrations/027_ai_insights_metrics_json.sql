-- 027_ai_insights_metrics_json.sql
-- Add metrics_json column to ai_insights for weekly report metrics sync.
-- Stores structured JSON (sessions, totalReps, streakWeeks, repsWeekChangePct, weekStart, weekEnd)
-- so the weekly report card can display metrics grid on all devices.

ALTER TABLE public.ai_insights
  ADD COLUMN IF NOT EXISTS metrics_json text;
