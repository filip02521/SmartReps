import { describe, expect, it } from 'vitest'
import { isChunkLoadError } from '@/lib/chunk-load-recovery'

describe('isChunkLoadError', () => {
  it('detects Vite dynamic import failures', () => {
    expect(
      isChunkLoadError(
        new Error('Failed to fetch dynamically imported module: https://example.com/assets/Plans-abc.js'),
      ),
    ).toBe(true)
  })

  it('detects generic chunk load messages', () => {
    expect(isChunkLoadError(new Error('Loading chunk 42 failed'))).toBe(true)
    expect(isChunkLoadError(new Error('Importing a module script failed'))).toBe(true)
  })

  it('ignores unrelated errors', () => {
    expect(isChunkLoadError(new Error('Network request failed'))).toBe(false)
    expect(isChunkLoadError('string error')).toBe(false)
    expect(isChunkLoadError(null)).toBe(false)
  })
})
