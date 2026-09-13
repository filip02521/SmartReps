-- 090_ai_insight_tombstones.sql
-- Durable delete markers for ai_insights. Without them, an insight deleted on
-- device A can be resurrected by device B's stale copy (queued update or the
-- unique week_key conflict path). Mirrors session_tombstones (025).

CREATE TABLE IF NOT EXISTS public.ai_insight_tombstones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_id text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, insight_id)
);

ALTER TABLE public.ai_insight_tombstones ENABLE ROW LEVEL SECURITY;
CREATE POLICY ai_insight_tombstones_owner ON public.ai_insight_tombstones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Reload PostgREST schema cache so the new table is immediately visible
NOTIFY pgrst, 'reload schema';
