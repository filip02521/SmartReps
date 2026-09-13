// Edge Function: ai-proxy
// Deploy: supabase functions deploy ai-proxy --no-verify-jwt
// Auth: user JWT (Authorization: Bearer <access_token>)
// Secrets:
//   AI_API_KEY   — provider key (OpenAI/Gemini/Groq OpenAI-compatible)
//   AI_BASE_URL  — optional, default https://api.openai.com/v1
//   AI_MODEL     — optional, default gpt-4o-mini. Recommended: gpt-5-mini
//                (best quality/cost for coaching analysis, strong Polish).
//                Budget alternative: gemini-2.5-flash-lite on AI_BASE_URL
//                https://generativelanguage.googleapis.com/v1beta/openai
//   AI_MODEL_PRO — optional; model used for pro/trial/lifetime users.
//                Recommended: gpt-5.4-mini (noticeably better analysis).
//
// Hosted AI calls for SmartReps. The provider key never ships to clients —
// users authenticate with their session JWT and the function enforces a
// per-user daily quota (ai_usage_daily + ai_consume RPC) before proxying
// the chat completion to the configured provider.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// AI is Pro-only: free users get 403 before any quota is consumed. Pro,
// trial and lifetime get a daily quota as abuse/cost control. 30/day is
// ~10x a realistic training day (insight + report + analysis); a higher cap
// would let scripted abuse exceed a monthly subscription's value.
const PRO_DAILY_LIMIT = 30

// Per-feature caps for expensive calls — plan_generation is ~10x the cost of
// a short insight and has no legitimate need for more than a few/day.
const FEATURE_DAILY_LIMITS: Record<string, number> = {
  plan_generation: 3,
  progression_adaptation: 5,
  workout_analysis: 10,
}

const ALLOWED_FEATURES = new Set([
  'weekly_report',
  'post_workout',
  'workout_analysis',
  'plan_generation',
  'progression_adaptation',
])

// Request hygiene — never trust client-provided sizes.
const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 24_000
const MAX_TOKENS_CAP = 8_000

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

type ChatMessage = { role: string; content: string }

function isValidMessages(raw: unknown): raw is ChatMessage[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return false
  return raw.every(
    (m) =>
      m &&
      typeof m === 'object' &&
      (m.role === 'system' || m.role === 'user' || m.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.length > 0 &&
      m.content.length <= MAX_MESSAGE_CHARS,
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const apiKey = Deno.env.get('AI_API_KEY')
  if (!apiKey) {
    console.error('ai-proxy: AI_API_KEY secret is not configured')
    return json(503, { error: 'ai_not_configured' })
  }

  // ── Auth: user JWT required (per-user quota + abuse control) ──
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return json(401, { error: 'unauthorized' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt)
  if (userError || !userData.user) return json(401, { error: 'unauthorized' })
  const userId = userData.user.id

  // ── Parse + validate request ──
  let body: {
    feature?: unknown
    messages?: unknown
    jsonMode?: unknown
    temperature?: unknown
    maxTokens?: unknown
  }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'bad_request' })
  }

  const feature = typeof body.feature === 'string' ? body.feature : ''
  if (!ALLOWED_FEATURES.has(feature)) {
    return json(400, { error: 'unknown_feature' })
  }
  if (!isValidMessages(body.messages)) {
    return json(400, { error: 'bad_messages' })
  }

  const jsonMode = body.jsonMode === true
  const temperature =
    typeof body.temperature === 'number' && body.temperature >= 0 && body.temperature <= 2
      ? body.temperature
      : 0.6
  const maxTokens =
    typeof body.maxTokens === 'number' && body.maxTokens > 0
      ? Math.min(Math.floor(body.maxTokens), MAX_TOKENS_CAP)
      : undefined

  // ── Tier → daily limit ──
  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin
    .from('profiles')
    .select('subscription_status, subscription_expires_at')
    .eq('id', userId)
    .maybeSingle()

  const status = (profile?.subscription_status as string | undefined) ?? 'free'
  const expiresAt = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at as string)
    : null
  // 'trial' must also honor expiresAt — subscription_status stays 'trial'
  // until a webhook/cron flips it to 'expired', so without this check a
  // trial that has already ended would keep unlimited hosted-AI access
  // for as long as that background job is delayed or hasn't run yet.
  const isProTier =
    status === 'lifetime' ||
    ((status === 'trial' || status === 'pro') && (!expiresAt || expiresAt > new Date()))

  // Hard gate — AI requires Pro (or active trial). Free users get 403
  // before any quota is consumed; the client shows the upgrade teaser.
  if (!isProTier) {
    return json(403, { error: 'pro_required' })
  }
  const dailyLimit = PRO_DAILY_LIMIT

  // ── Atomic quota consume ──
  const featureLimit = FEATURE_DAILY_LIMITS[feature]
  const { data: consumed, error: consumeError } = await admin.rpc('ai_consume', {
    p_user_id: userId,
    p_feature: feature,
    p_daily_limit: dailyLimit,
    p_feature_limit: featureLimit ?? null,
  })
  if (consumeError) {
    console.error('ai_consume failed', consumeError.message)
    return json(500, { error: 'quota_check_failed' })
  }
  if (consumed === -1 || consumed === -2) {
    return json(429, {
      error: 'quota_exceeded',
      dailyLimit,
      proLimit: PRO_DAILY_LIMIT,
      // -2 = the feature-specific cap, not the global daily cap.
      ...(consumed === -2 ? { featureLimit, feature } : {}),
    })
  }

  // ── Call provider ──
  const baseURL = (Deno.env.get('AI_BASE_URL') ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model =
    (isProTier ? Deno.env.get('AI_MODEL_PRO') : undefined) ||
    Deno.env.get('AI_MODEL') ||
    'gpt-4o-mini'

  // Return the consumed quota slot when the provider call fails — users
  // should not burn their daily limit on upstream errors.
  const refundQuota = async () => {
    try {
      await admin.rpc('ai_refund', { p_user_id: userId, p_feature: feature })
    } catch (e) {
      console.error('ai_refund failed', e)
    }
  }

  const lowerModel = model.toLowerCase()
  const isGeminiEndpoint = baseURL.includes('googleapis') || baseURL.includes('gemini')
  // Mirrors canDisableReasoning() from src/lib/ai/ai-client.ts: only Gemini
  // 2.5 Flash/Flash-Lite accept reasoning_effort 'none' (fastest, cheapest —
  // hosted mode always uses the 'auto' preference).
  const disableReasoning =
    isGeminiEndpoint && lowerModel.includes('gemini-2.5-flash')
  // OpenAI reasoning models (o-series, gpt-5.x+) reject `temperature` (only
  // default 1 allowed) and require `max_completion_tokens` instead of
  // `max_tokens` — sending either wrong parameter returns HTTP 400.
  const isOpenAiReasoning = /^(o\d|gpt-[56])/i.test(lowerModel)

  let upstream: Response
  try {
    upstream = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: body.messages,
        // Gemini 3.x rejects `temperature` (returns 508) — mirror the
        // client-side guard from src/lib/ai/ai-client.ts.
        ...(!/gemini-3/i.test(lowerModel) && !isOpenAiReasoning ? { temperature } : {}),
        ...(maxTokens
          ? isOpenAiReasoning
            ? // Hidden reasoning tokens count against max_completion_tokens —
              // add headroom so a thinking budget can't starve the answer.
              { max_completion_tokens: Math.min(maxTokens + 1024, 12_000) }
            : { max_tokens: maxTokens }
          : {}),
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(disableReasoning ? { reasoning_effort: 'none' } : {}),
        // Cap hidden reasoning spend on OpenAI reasoning models: 'low' for
        // short insights, 'medium' for plan generation where quality pays.
        ...(isOpenAiReasoning
          ? { reasoning_effort: feature === 'plan_generation' ? 'medium' : 'low' }
          : {}),
      }),
      signal: AbortSignal.timeout(30_000),
    })
  } catch (e) {
    console.error('ai-proxy upstream fetch failed', e)
    await refundQuota()
    return json(502, { error: 'provider_unreachable' })
  }

  if (!upstream.ok) {
    let detail = ''
    try {
      const errBody = await upstream.json()
      detail = errBody?.error?.message ?? ''
    } catch {
      // ignore
    }
    console.error(`ai-proxy provider error ${upstream.status}: ${detail}`)
    await refundQuota()
    // Never forward provider internals — map to a neutral error.
    return json(502, { error: 'provider_error', status: upstream.status })
  }

  let data: {
    choices?: { message?: { content?: unknown } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  try {
    data = await upstream.json()
  } catch {
    await refundQuota()
    return json(502, { error: 'provider_bad_response' })
  }

  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    await refundQuota()
    return json(502, { error: 'provider_bad_response' })
  }

  return json(200, {
    content,
    usage: {
      promptTokens: data?.usage?.prompt_tokens,
      completionTokens: data?.usage?.completion_tokens,
    },
    remaining: Math.max(0, dailyLimit - (consumed as number)),
    dailyLimit,
  })
})
