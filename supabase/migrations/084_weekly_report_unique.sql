-- Migration 084: One weekly report per user per week.
-- send-weekly-report checks for an existing report before generating, but a
-- plain index means concurrent runs (cron + client-generated, or two runs)
-- can double-insert. A production duplicate already existed. Partial unique
-- index makes the dedupe atomic; the client insert path uses upsert-safe
-- semantics elsewhere so a conflict surfaces as a handled error.
create unique index if not exists ai_insights_weekly_report_unique
  on public.ai_insights (user_id, week_key)
  where type = 'weekly_report' and week_key is not null;
