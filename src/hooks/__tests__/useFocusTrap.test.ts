import { describe, expect, it, beforeEach } from 'vitest'
import { releaseBodyScrollLock } from '@/hooks/useFocusTrap'

describe('releaseBodyScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
    releaseBodyScrollLock()
  })

  it('clears hidden overflow left by rest timer focus trap', () => {
    document.body.style.overflow = 'hidden'
    releaseBodyScrollLock()
    expect(document.body.style.overflow).toBe('')
  })
})
