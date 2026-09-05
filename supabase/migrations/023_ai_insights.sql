-- 023_ai_insights.sql
-- Proactive AI Coach insights: post-workout, weekly reports, plateau warnings.
-- Synced from local Dexie; RLS-protected per user.

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('post_workout','weekly_report','plateau_warning')),
  session_id uuid REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  week_key text,
  program text,
  custom_plan_id uuid,
  title text NOT NULL,
  body text NOT NULL,
  tone text NOT NULL DEFAULT 'insight' CHECK (tone IN ('insight','warning','success')),
  source text NOT NULL DEFAULT 'local' CHECK (source IN ('local','ai')),
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz,
  read_at timestamptz
);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_insights_owner ON public.ai_insights
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS ai_insights_user_week ON public.ai_insights(user_id, week_key);
CREATE INDEX IF NOT EXISTS ai_insights_user_session ON public.ai_insights(user_id, session_id);
CREATE INDEX IF NOT EXISTS ai_insights_user_type ON public.ai_insights(user_id, type);
