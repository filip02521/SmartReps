/**
 * Minimal OpenAI-compatible chat completion client.
 * Supports OpenAI and any OpenAI-compatible endpoint (e.g. Groq, OpenRouter).
 */

import { pl } from '@/i18n/pl'

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type ChatCompletionOptions = {
  apiKey: string
  model: string
  messages: ChatMessage[]
  /** When true, response_format json_object is used. */
  jsonMode?: boolean
  /** Optional baseURL override (e.g. for OpenRouter/Groq). */
  baseURL?: string
  temperature?: number
  maxTokens?: number
  /** Disable thinking/reasoning (Gemini 2.5+). Values: "none" | "low" | "medium" | "high". */
  reasoningEffort?: 'none' | 'low' | 'medium' | 'high'
  signal?: AbortSignal
  /** Request timeout in ms. Default: 60000 (60s). */
  timeoutMs?: number
}

export type ChatCompletionResult = {
  content: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
  }
}

/**
 * Check if reasoning_effort: 'none' is supported for a given model.
 * Per Gemini docs: only Gemini 2.5 Flash and 2.5 Flash-Lite support disabling reasoning.
 * Gemini 2.5 Pro and all Gemini 3.x models do NOT support 'none' (returns 400).
 */
export function canDisableReasoning(model: string): boolean {
  const m = model.toLowerCase()
  // Gemini 2.5 Flash and Flash-Lite support reasoning_effort: 'none'
  if (m.includes('gemini-2.5-flash')) return true
  // Gemini 2.5 Pro does NOT support 'none'
  if (m.includes('gemini-2.5-pro')) return false
  // Gemini 3.x models do NOT support 'none'
  if (m.match(/gemini-3/)) return false
  // Non-Gemini models: 'none' is not a standard OpenAI parameter, skip
  if (!m.includes('gemini')) return false
  // Other Gemini models (2.0, 1.5): don't support reasoning_effort at all
  return false
}

/**
 * Check if the endpoint is a Gemini OpenAI-compatible endpoint.
 */
export function isGeminiEndpoint(baseURL?: string): boolean {
  return !!baseURL && (baseURL.includes('gemini') || baseURL.includes('googleapis'))
}

/**
 * Check if the model is a Gemini 3.x model.
 * Gemini 3.x deprecates `temperature` in favor of `thinking_level` (mapped from `reasoning_effort`).
 * Sending `temperature` with Gemini 3.x can cause HTTP 508 errors.
 */
export function isGemini3Model(model: string): boolean {
  return /gemini-3/i.test(model)
}

/**
 * Resolve reasoning effort for a given model and user preference.
 * - 'auto': disable reasoning when possible (fastest, cheapest)
 * - 'low'/'medium'/'high': explicitly set reasoning level (works for all Gemini models that support reasoning)
 * Returns undefined if reasoning should not be sent (non-Gemini models, or 'auto' on unsupported models).
 */
export function resolveReasoningEffort(
  model: string,
  preference?: 'auto' | 'low' | 'medium' | 'high',
): 'none' | 'low' | 'medium' | 'high' | undefined {
  if (!preference || preference === 'auto') {
    return canDisableReasoning(model) ? 'none' : undefined
  }
  // For non-Gemini models, reasoning_effort is not a standard OpenAI parameter — skip
  if (!model.toLowerCase().includes('gemini')) return undefined
  return preference
}

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

export class AiApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly kind: 'auth' | 'rate_limit' | 'network' | 'server' | 'parse' | 'offline' = 'server',
  ) {
    super(message)
    this.name = 'AiApiError'
  }
}

export async function chatCompletion(opts: ChatCompletionOptions): Promise<ChatCompletionResult> {
  if (!navigator.onLine) {
    throw new AiApiError(pl.aiErrorOfflineConnection, undefined, 'offline')
  }
  if (!opts.apiKey?.trim()) {
    throw new AiApiError(pl.aiErrorNoApiKey, undefined, 'auth')
  }

  const baseURL = (opts.baseURL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const url = `${baseURL}/chat/completions`

  // Default timeout: 60s for analysis, 30s for others. Prevents hung requests
  // that block the UI forever when the provider is slow or unresponsive.
  const timeoutMs = opts.timeoutMs ?? 60_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // If caller provided their own signal, forward its abort to our controller
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
    // Only send reasoning_effort if the model supports it
    const shouldSendReasoning =
      opts.reasoningEffort &&
      (opts.reasoningEffort !== 'none' || canDisableReasoning(opts.model))

    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        // Gemini 3.x deprecates temperature in favor of thinking_level (reasoning_effort).
        // Sending temperature with Gemini 3.x can cause HTTP 508 errors.
        ...(!isGemini3Model(opts.model) ? { temperature: opts.temperature ?? 0.7 } : {}),
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(shouldSendReasoning ? { reasoning_effort: opts.reasoningEffort } : {}),
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      // Distinguish user-initiated abort from timeout abort
      if (opts.signal?.aborted) throw e
      throw new AiApiError(pl.aiErrorConnection, undefined, 'network')
    }
    throw new AiApiError(
      pl.aiErrorConnection,
      undefined,
      'network',
    )
  } finally {
    clearTimeout(timeoutId)
    if (externalAbort && opts.signal) {
      opts.signal.removeEventListener('abort', externalAbort)
    }
  }

  if (!resp.ok) {
    let detail = ''
    try {
      const body = await resp.json()
      detail = body?.error?.message ?? ''
    } catch {
      // ignore
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new AiApiError(
        pl.aiErrorInvalidKey(detail),
        resp.status,
        'auth',
      )
    }
    if (resp.status === 404) {
      throw new AiApiError(
        pl.aiErrorModelNotFound(opts.model),
        resp.status,
        'server',
      )
    }
    if (resp.status === 400) {
      throw new AiApiError(
        pl.aiErrorBadRequest(detail || opts.model),
        resp.status,
        'server',
      )
    }
    if (resp.status === 508) {
      throw new AiApiError(
        pl.aiErrorLoopDetected,
        resp.status,
        'server',
      )
    }
    if (resp.status === 503) {
      throw new AiApiError(
        pl.aiErrorServiceUnavailable,
        resp.status,
        'server',
      )
    }
    if (resp.status === 429) {
      throw new AiApiError(
        pl.aiErrorRateLimited,
        resp.status,
        'rate_limit',
      )
    }
    throw new AiApiError(
      pl.aiErrorGenericStatus(resp.status, detail),
      resp.status,
      'server',
    )
  }

  let data: { choices?: { message?: { content?: unknown } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
  try {
    data = await resp.json()
  } catch {
    throw new AiApiError(pl.aiErrorInvalidResponse, undefined, 'parse')
  }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new AiApiError(pl.aiErrorInvalidResponse, undefined, 'parse')
  }
  return {
    content,
    usage: {
      promptTokens: data?.usage?.prompt_tokens,
      completionTokens: data?.usage?.completion_tokens,
    },
  }
}

/** Parse JSON from model response, handling markdown code fences. */
export function parseJsonResponse<T>(content: string): T {
  let cleaned = content.trim()
  // Strip markdown code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  try {
    return JSON.parse(cleaned) as T
  } catch {
    // Try to extract a JSON object or array from surrounding text.
    // Use a brace-matching approach instead of greedy regex to avoid
    // capturing multiple objects or trailing text.
    const extracted = extractFirstJson(cleaned)
    if (extracted) {
      try {
        return JSON.parse(extracted) as T
      } catch {
        // fall through
      }
    }
    throw new AiApiError(
      pl.aiErrorParseJson,
      undefined,
      'parse',
    )
  }
}

/**
 * Extract the first balanced JSON object or array from a string.
 * Handles nested braces/brackets and string literals (with escape sequences).
 * Returns null if no valid JSON fragment is found.
 */
function extractFirstJson(text: string): string | null {
  const start = text.indexOf('{')
  const arrStart = text.indexOf('[')
  const realStart = start === -1 ? arrStart : arrStart === -1 ? start : Math.min(start, arrStart)
  if (realStart === -1) return null

  const open = text[realStart]
  const close = open === '{' ? '}' : ']'
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = realStart; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === '"') {
        inString = false
      }
      continue
    }
    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === open) {
      depth++
    } else if (ch === close) {
      depth--
      if (depth === 0) {
        return text.slice(realStart, i + 1)
      }
    }
  }
  return null
}
