import { pl } from '@/i18n/pl'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import {
  AiApiError,
  chatCompletion,
  resolveReasoningEffort,
  isGeminiEndpoint,
  isOpenAiReasoningModel,
  type ChatCompletionResult,
  type ChatMessage,
} from './ai-client'
import type { AiFeature } from './rate-limiter'
import { isPro } from '@/lib/subscription'

export type { AiFeature }

// Daily managed-AI quota for Pro/trial/lifetime. Mirrored in the ai-proxy
// Edge Function (supabase/functions/ai-proxy/index.ts) — keep in sync.
// Free users get no AI at all (hard paywall — hosted and BYOK alike).
export const MANAGED_PRO_DAILY_LIMIT = 60

/**
 * How an AI call is executed. Two modes:
 * - `managed`: requests go through the ai-proxy Edge Function using the
 *   SmartReps-owned provider key. Requires a logged-in session. Server
 *   enforces per-user daily quota; Pro raises it. Provider/model are chosen
 *   server-side — the client cannot pick the endpoint.
 * - BYOK: user's own OpenAI-compatible key (advanced option, free).
 */
export type AiContext = {
  apiKey?: string
  model?: string
  baseURL?: string
  reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
  managed?: boolean
}

export type AiChatOptions = {
  feature: AiFeature
  messages: ChatMessage[]
  jsonMode?: boolean
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  timeoutMs?: number
}

export type ManagedAiResult = ChatCompletionResult & {
  /** Remaining managed calls today, when the server reports it. */
  remaining?: number
  dailyLimit?: number
}

/**
 * Hosted AI requires an authenticated Supabase session AND active Pro access
 * (pro/trial/lifetime). Free users get no AI — hard paywall.
 */
export function canUseManagedAi(loggedIn: boolean, proAccess: boolean): boolean {
  return loggedIn && proAccess && isSupabaseConfigured
}

/**
 * Pick the execution context for an AI call. AI is Pro-only — a configured
 * BYOK key wins when the user has Pro (they explicitly chose their own
 * provider); otherwise Pro users fall back to hosted SmartReps AI.
 */
export function resolveAiContext(
  settings: { aiApiKey?: string; aiModel?: string; aiBaseUrl?: string; aiReasoningEffort?: string },
  loggedIn: boolean,
  proAccess: boolean,
): AiContext | undefined {
  if (!proAccess) return undefined
  if (settings.aiApiKey) {
    return {
      apiKey: settings.aiApiKey,
      model: settings.aiModel,
      baseURL: settings.aiBaseUrl,
      reasoningEffort: (settings.aiReasoningEffort as AiContext['reasoningEffort']) ?? 'auto',
    }
  }
  if (canUseManagedAi(loggedIn, proAccess)) {
    return { managed: true }
  }
  return undefined
}

/**
 * Async variant for non-reactive call sites (session summary, dashboard
 * effects). Checks the live Supabase session + Pro status at call time.
 */
export async function resolveAiContextForCall(settings: {
  aiApiKey?: string
  aiModel?: string
  aiBaseUrl?: string
  aiReasoningEffort?: string
}): Promise<AiContext | undefined> {
  if (!isPro()) return undefined
  if (settings.aiApiKey) {
    return {
      apiKey: settings.aiApiKey,
      model: settings.aiModel,
      baseURL: settings.aiBaseUrl,
      reasoningEffort: (settings.aiReasoningEffort as AiContext['reasoningEffort']) ?? 'auto',
    }
  }
  if (!isSupabaseConfigured) return undefined
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user ? { managed: true } : undefined
  } catch {
    return undefined
  }
}

async function managedChatCompletion(opts: AiChatOptions): Promise<ManagedAiResult> {
  if (!navigator.onLine) {
    throw new AiApiError(pl.aiErrorOfflineConnection, undefined, 'offline')
  }
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    throw new AiApiError(pl.aiErrorSessionRequired, undefined, 'auth')
  }

  const timeoutMs = opts.timeoutMs ?? 60_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  let externalAbort: (() => void) | null = null
  if (opts.signal) {
    if (opts.signal.aborted) controller.abort()
    else {
      externalAbort = () => controller.abort()
      opts.signal.addEventListener('abort', externalAbort, { once: true })
    }
  }

  let resp: Response
  try {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
    resp = await fetch(`${supabaseUrl}/functions/v1/ai-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({
        feature: opts.feature,
        messages: opts.messages,
        jsonMode: opts.jsonMode,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      if (opts.signal?.aborted) throw e
      throw new AiApiError(pl.aiErrorConnection, undefined, 'network')
    }
    throw new AiApiError(pl.aiErrorConnection, undefined, 'network')
  } finally {
    clearTimeout(timeoutId)
    if (externalAbort && opts.signal) {
      opts.signal.removeEventListener('abort', externalAbort)
    }
  }

  let body: {
    error?: string
    content?: string
    remaining?: number
    dailyLimit?: number
    usage?: { promptTokens?: number; completionTokens?: number }
  } | null = null
  try {
    body = await resp.json()
  } catch {
    // non-JSON response — fall through to the status-based mapping
  }

  if (!resp.ok) {
    if (resp.status === 401) {
      throw new AiApiError(pl.aiErrorSessionRequired, 401, 'auth')
    }
    if (resp.status === 403 || body?.error === 'pro_required') {
      throw new AiApiError(pl.aiErrorProRequired, 403, 'pro_required')
    }
    if (resp.status === 429 || body?.error === 'quota_exceeded') {
      throw new AiApiError(pl.aiErrorQuotaExceeded, 429, 'quota')
    }
    throw new AiApiError(pl.aiErrorConnection, resp.status, 'server')
  }

  if (typeof body?.content !== 'string' || body.content.length === 0) {
    throw new AiApiError(pl.aiErrorInvalidResponse, undefined, 'parse')
  }

  return {
    content: body.content,
    remaining: typeof body.remaining === 'number' ? body.remaining : undefined,
    dailyLimit: typeof body.dailyLimit === 'number' ? body.dailyLimit : undefined,
    usage: body.usage,
  }
}

/**
 * Single entry point for all AI chat calls. Routes to the managed proxy when
 * the context requests it, otherwise calls the user's provider directly.
 */
export async function aiChat(ctx: AiContext, opts: AiChatOptions): Promise<ChatCompletionResult> {
  if (ctx.managed) {
    return managedChatCompletion(opts)
  }
  if (!ctx.apiKey) {
    throw new AiApiError(pl.aiErrorNoApiKey, undefined, 'auth')
  }
  const model = ctx.model || 'gpt-4o-mini'
  // resolveReasoningEffort returns undefined for models that don't support it.
  const reasoningEffort = isGeminiEndpoint(ctx.baseURL) || isOpenAiReasoningModel(model)
    ? resolveReasoningEffort(model, ctx.reasoningEffort)
    : undefined
  return chatCompletion({
    apiKey: ctx.apiKey,
    model,
    baseURL: ctx.baseURL,
    messages: opts.messages,
    jsonMode: opts.jsonMode,
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    reasoningEffort,
    signal: opts.signal,
    timeoutMs: opts.timeoutMs,
  })
}

export type ManagedAiStatus = {
  loggedIn: boolean
  /** Server-side Pro verdict — authoritative over the cached local copy. */
  pro: boolean
  remaining: number | null
  dailyLimit: number | null
}

/**
 * Read the caller's hosted-AI status: Pro tier + remaining calls today.
 * Used by settings UI to show a transparent quota meter.
 */
export async function fetchManagedAiStatus(): Promise<ManagedAiStatus> {
  const base: ManagedAiStatus = { loggedIn: false, pro: false, remaining: null, dailyLimit: null }
  if (!isSupabaseConfigured) return base
  const { data: sessionData } = await supabase.auth.getSession()
  if (!sessionData.session?.user) return base
  const userId = sessionData.session.user.id

  const today = new Date().toISOString().slice(0, 10)
  const [{ data: usage }, { data: profile }] = await Promise.all([
    supabase
      .from('ai_usage_daily')
      .select('call_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('subscription_status, subscription_expires_at')
      .eq('id', userId)
      .maybeSingle(),
  ])

  const status = (profile?.subscription_status as string | undefined) ?? 'free'
  const expiresAt = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at as string)
    : null
  // 'trial' must also honor expiresAt — see the matching comment in
  // supabase/functions/ai-proxy/index.ts (must stay in sync with the
  // server-side check, which is the actual enforcement point).
  const pro =
    status === 'lifetime' ||
    ((status === 'trial' || status === 'pro') && (!expiresAt || expiresAt > new Date()))
  const dailyLimit = MANAGED_PRO_DAILY_LIMIT
  const used = typeof usage?.call_count === 'number' ? usage.call_count : 0
  return {
    loggedIn: true,
    pro,
    remaining: pro ? Math.max(0, dailyLimit - used) : null,
    dailyLimit: pro ? dailyLimit : null,
  }
}
