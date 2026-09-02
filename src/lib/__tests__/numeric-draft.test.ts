import { describe, expect, it } from 'vitest'
import {
  commitNumericDraft,
  formatNumericDisplay,
  normalizeDecimalDraft,
  normalizeIntegerDraft,
  parseDecimalDraft,
  parseIntegerDraft,
} from '@/lib/numeric-draft'

describe('numeric-draft integer', () => {
  it('allows clearing digits', () => {
    expect(normalizeIntegerDraft('')).toBe('')
    expect(normalizeIntegerDraft('12a3')).toBe('123')
  })

  it('parses empty as null so UI can stay blank', () => {
    expect(parseIntegerDraft('')).toBeNull()
    expect(parseIntegerDraft('40')).toBe(40)
  })

  it('commits empty to fallback', () => {
    expect(commitNumericDraft('', 'integer', { emptyValue: 0 })).toBe(0)
    expect(commitNumericDraft('8', 'integer')).toBe(8)
  })
})

describe('numeric-draft decimal', () => {
  it('accepts comma and keeps trailing separator', () => {
    expect(normalizeDecimalDraft('12,')).toBe('12,')
    expect(normalizeDecimalDraft('12.5')).toBe('12,5')
    expect(normalizeDecimalDraft('12,5,5')).toBe('12,55')
  })

  it('parses PL comma decimals', () => {
    expect(parseDecimalDraft('47,5')).toBe(47.5)
    expect(parseDecimalDraft('')).toBeNull()
    expect(parseDecimalDraft(',')).toBeNull()
  })

  it('formats with comma', () => {
    expect(formatNumericDisplay(47.5, 'decimal')).toBe('47,5')
    expect(formatNumericDisplay(40, 'integer')).toBe('40')
  })
})
