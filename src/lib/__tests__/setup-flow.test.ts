import { describe, expect, it } from 'vitest'
import { isProgram } from '@/lib/setup-flow'

describe('setup-flow', () => {
  it('accepts only pushups and pullups', () => {
    expect(isProgram('pushups')).toBe(true)
    expect(isProgram('pullups')).toBe(true)
    expect(isProgram('foo')).toBe(false)
    expect(isProgram(undefined)).toBe(false)
    expect(isProgram(null)).toBe(false)
  })
})
