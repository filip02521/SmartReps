import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock i18n — managed-client imports pl for error messages
vi.mock('@/i18n/pl', () => ({
  pl: {
    aiErrorOfflineConnection: 'offline',
    aiErrorNoApiKey: 'no key',
    aiErrorSessionRequired: 'login required',
    aiErrorQuotaExceeded: 'quota exceeded',
    aiErrorConnection: 'network error',
    aiErrorInvalidResponse: 'invalid response',
    aiErrorParseJson: 'parse error',
  },
}))

const mockGetSession = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}))

const mockChatCompletion = vi.fn()

vi.mock('@/lib/ai/ai-client', () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  parseJsonResponse: vi.fn(),
  canDisableReasoning: () => false,
  isGeminiEndpoint: (u?: string) => !!u && u.includes('googleapis'),
  isOpenAiReasoningModel: (m: string) => /^(o\d|gpt-[56])/i.test(m.trim()),
  resolveReasoningEffort: () => undefined,
  AiApiError: class extends Error {
    kind?: string
    constructor(msg: string, _status: number | undefined, kind: string) {
      super(msg)
      this.kind = kind
      this.name = 'AiApiError'
    }
  },
}))

import {
  resolveAiContext,
  canUseManagedAi,
  aiChat,
} from '../ai/managed-client'
import { AiApiError } from '../ai/ai-client'

const baseSettings = {
  aiApiKey: '',
  aiModel: 'gpt-4o-mini',
  aiBaseUrl: '',
  aiReasoningEffort: 'auto',
}

describe('canUseManagedAi', () => {
  it('true only when logged in, Pro, and Supabase configured', () => {
    expect(canUseManagedAi(true, true)).toBe(true)
    expect(canUseManagedAi(false, true)).toBe(false)
    expect(canUseManagedAi(true, false)).toBe(false)
  })
})

describe('resolveAiContext', () => {
  it('returns BYOK context when apiKey is set and user has Pro', () => {
    const ctx = resolveAiContext({ ...baseSettings, aiApiKey: 'sk-test' }, true, true)
    expect(ctx).toEqual({
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      baseURL: '',
      reasoningEffort: 'auto',
    })
  })

  it('BYOK wins over managed even when logged in', () => {
    const ctx = resolveAiContext({ ...baseSettings, aiApiKey: 'sk-x' }, true, true)
    expect(ctx?.managed).toBeUndefined()
    expect(ctx?.apiKey).toBe('sk-x')
  })

  it('returns managed context when logged-in Pro user has no key', () => {
    expect(resolveAiContext(baseSettings, true, true)).toEqual({ managed: true })
  })

  it('returns undefined when logged out without key', () => {
    expect(resolveAiContext(baseSettings, false, true)).toBeUndefined()
  })

  it('hard paywall: no AI for free users — even with BYOK key configured', () => {
    expect(resolveAiContext({ ...baseSettings, aiApiKey: 'sk-x' }, true, false)).toBeUndefined()
    expect(resolveAiContext(baseSettings, true, false)).toBeUndefined()
  })
})

describe('aiChat — routing', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok-1', user: { id: 'u1' } } },
    })
    mockChatCompletion.mockResolvedValue({ content: 'ok' })
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('managed context → calls ai-proxy with user JWT, never the provider key', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ content: 'hi', remaining: 7, dailyLimit: 8 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const result = await aiChat(
      { managed: true },
      { feature: 'post_workout', messages: [{ role: 'user', content: 'test' }] },
    )

    expect(result.content).toBe('hi')
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/functions/v1/ai-proxy')
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-1')
    // The provider key must never appear in the request
    expect(JSON.stringify(init.body)).not.toContain('sk-')
    expect(mockChatCompletion).not.toHaveBeenCalled()
  })

  it('managed context without session → auth error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })
    await expect(
      aiChat({ managed: true }, { feature: 'post_workout', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow('login required')
  })

  it('managed quota exceeded (429) → quota error kind', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'quota_exceeded', dailyLimit: 8 }), {
          status: 429,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ) as unknown as typeof fetch

    try {
      await aiChat(
        { managed: true },
        { feature: 'weekly_report', messages: [{ role: 'user', content: 'x' }] },
      )
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(AiApiError)
      expect((e as { kind?: string }).kind).toBe('quota')
    }
  })

  it('managed 403 pro_required → pro_required error kind', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'pro_required' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ) as unknown as typeof fetch

    try {
      await aiChat(
        { managed: true },
        { feature: 'weekly_report', messages: [{ role: 'user', content: 'x' }] },
      )
      expect.unreachable()
    } catch (e) {
      expect((e as { kind?: string }).kind).toBe('pro_required')
    }
  })

  it('managed 401 → auth error kind', async () => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    ) as unknown as typeof fetch

    try {
      await aiChat(
        { managed: true },
        { feature: 'weekly_report', messages: [{ role: 'user', content: 'x' }] },
      )
      expect.unreachable()
    } catch (e) {
      expect((e as { kind?: string }).kind).toBe('auth')
    }
  })

  it('BYOK context → delegates to chatCompletion', async () => {
    const result = await aiChat(
      { apiKey: 'sk-user', model: 'gpt-4o-mini' },
      { feature: 'workout_analysis', messages: [{ role: 'user', content: 'x' }], jsonMode: true },
    )
    expect(result.content).toBe('ok')
    expect(mockChatCompletion).toHaveBeenCalledOnce()
    const arg = mockChatCompletion.mock.calls[0]?.[0] as { apiKey: string; model: string }
    expect(arg.apiKey).toBe('sk-user')
    expect(arg.model).toBe('gpt-4o-mini')
  })

  it('no key and not managed → auth error without any fetch', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    await expect(
      aiChat({}, { feature: 'post_workout', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toThrow('no key')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
