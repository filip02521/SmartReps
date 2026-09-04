/**
 * Minimal OpenAI-compatible chat completion client.
 * Supports OpenAI and any OpenAI-compatible endpoint (e.g. Groq, OpenRouter).
 */

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
}

export type ChatCompletionResult = {
  content: string
  usage?: {
    promptTokens?: number
    completionTokens?: number
  }
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
    throw new AiApiError('Brak połączenia z internetem.', undefined, 'offline')
  }
  if (!opts.apiKey?.trim()) {
    throw new AiApiError('Brak klucza API.', undefined, 'auth')
  }

  const baseURL = opts.baseURL?.trim() || DEFAULT_BASE_URL
  const url = `${baseURL}/chat/completions`

  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.jsonMode ? { response_format: { type: 'json_object' } } : {}),
        ...(opts.reasoningEffort ? { reasoning_effort: opts.reasoningEffort } : {}),
      }),
      signal: opts.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e
    throw new AiApiError(
      'Nie udało się połączyć z API. Sprawdź połączenie internetowe.',
      undefined,
      'network',
    )
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
        `Nieprawidłowy klucz API. ${detail}`.trim(),
        resp.status,
        'auth',
      )
    }
    if (resp.status === 429) {
      throw new AiApiError(
        'Zbyt wiele zapytań. Poczekaj chwilę i spróbuj ponownie.',
        resp.status,
        'rate_limit',
      )
    }
    throw new AiApiError(
      `Błąd API (${resp.status}). ${detail}`.trim(),
      resp.status,
      'server',
    )
  }

  const data = await resp.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    throw new AiApiError('Nieprawidłowa odpowiedź API.', undefined, 'parse')
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
    // Try to extract JSON object from surrounding text
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]) as T
      } catch {
        // fall through
      }
    }
    throw new AiApiError(
      'AI zwrócił nieprawidłowy JSON. Spróbuj ponownie.',
      undefined,
      'parse',
    )
  }
}
