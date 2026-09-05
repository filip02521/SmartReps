-- 025_session_tombstones_and_ai_settings.sql
-- Session tombstones: prevent deleted sessions from being resurrected by cross-device sync.
-- AI settings: sync aiModel and aiBaseUrl (NOT aiApiKey — that stays local-only).

-- ── Session tombstones ──
CREATE TABLE IF NOT EXISTS public.session_tombstones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);

ALTER TABLE public.session_tombstones ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_tombstones_owner ON public.session_tombstones
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── AI model and base URL in profiles (NOT api key) ──
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_model text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ai_base_url text;
