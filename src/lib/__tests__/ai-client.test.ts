import { describe, it, expect, vi } from 'vitest'

// Mock i18n — ai-client imports pl for error messages
vi.mock('@/i18n/pl', () => ({
  pl: {
    aiErrorOfflineConnection: 'offline',
    aiErrorNoApiKey: 'no key',
    aiErrorConnection: 'network error',
    aiErrorInvalidKey: (d: string) => `invalid key: ${d}`,
    aiErrorRateLimited: 'rate limited',
    aiErrorGenericStatus: (s: number, d: string) => `error ${s}: ${d}`,
    aiErrorInvalidResponse: 'invalid response',
    aiErrorParseJson: 'parse error',
  },
}))

import { parseJsonResponse, AiApiError } from '../ai/ai-client'

describe('parseJsonResponse', () => {
  it('parses clean JSON', () => {
    const result = parseJsonResponse<{ a: number }>('{"a": 1}')
    expect(result.a).toBe(1)
  })

  it('parses JSON with markdown code fences', () => {
    const result = parseJsonResponse<{ a: number }>('```json\n{"a": 42}\n```')
    expect(result.a).toBe(42)
  })

  it('parses JSON with plain code fences', () => {
    const result = parseJsonResponse<{ a: number }>('```\n{"a": 99}\n```')
    expect(result.a).toBe(99)
  })

  it('extracts JSON object from surrounding text', () => {
    const result = parseJsonResponse<{ plan: { name: string } }>(
      'Here is your plan:\n{"plan": {"name": "Test"}}\nHope it helps!',
    )
    expect(result.plan.name).toBe('Test')
  })

  it('extracts first JSON object when multiple objects exist', () => {
    const result = parseJsonResponse<{ first: number }>(
      '{"first": 1} some text {"second": 2}',
    )
    expect(result.first).toBe(1)
  })

  it('handles nested objects correctly', () => {
    const result = parseJsonResponse<{ a: { b: { c: number } } }>(
      'Text {"a": {"b": {"c": 42}}} end',
    )
    expect(result.a.b.c).toBe(42)
  })

  it('handles strings with braces inside JSON', () => {
    const result = parseJsonResponse<{ msg: string }>(
      '{"msg": "hello {world}!"}',
    )
    expect(result.msg).toBe('hello {world}!')
  })

  it('handles escaped quotes in strings', () => {
    const result = parseJsonResponse<{ msg: string }>(
      '{"msg": "say \\"hi\\""}',
    )
    expect(result.msg).toBe('say "hi"')
  })

  it('throws AiApiError for invalid JSON', () => {
    expect(() => parseJsonResponse('not json at all')).toThrow(AiApiError)
  })

  it('throws AiApiError for unclosed JSON', () => {
    expect(() => parseJsonResponse('{"a": 1')).toThrow(AiApiError)
  })

  it('handles JSON arrays', () => {
    const result = parseJsonResponse<number[]>('text [1, 2, 3] end')
    expect(result).toEqual([1, 2, 3])
  })

  it('handles empty string', () => {
    expect(() => parseJsonResponse('')).toThrow(AiApiError)
  })

  it('handles whitespace-only string', () => {
    expect(() => parseJsonResponse('   \n  ')).toThrow(AiApiError)
  })

  it('handles nested arrays in objects', () => {
    const result = parseJsonResponse<{ items: number[] }>(
      '{"items": [1, [2, 3], 4]}',
    )
    expect(result.items).toEqual([1, [2, 3], 4])
  })
})
