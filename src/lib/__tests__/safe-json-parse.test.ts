import { describe, it, expect } from 'vitest'
import { safeJsonParse } from '@/lib/utils'

describe('safeJsonParse', () => {
  it('parses valid JSON string', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses valid JSON array string', () => {
    expect(safeJsonParse('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('returns null for malformed JSON', () => {
    expect(safeJsonParse('{invalid}')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(safeJsonParse('')).toBeNull()
  })

  it('returns non-string input as-is', () => {
    const obj = { foo: 'bar' }
    expect(safeJsonParse(obj)).toBe(obj)
  })

  it('returns null for null input', () => {
    expect(safeJsonParse(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(safeJsonParse(undefined)).toBeNull()
  })

  it('returns typed result with generic', () => {
    const result = safeJsonParse<{ x: number }>('{"x":42}')
    expect(result?.x).toBe(42)
  })

  it('handles nested JSON', () => {
    const result = safeJsonParse<{ data: { items: string[] } }>(
      '{"data":{"items":["a","b"]}}',
    )
    expect(result?.data.items).toEqual(['a', 'b'])
  })
})
