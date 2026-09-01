import { describe, expect, it, vi } from 'vitest'
import { registerSheetEscape } from '@/lib/sheet-escape'

describe('sheet-escape stack', () => {
  it('calls only the topmost handler on Escape', () => {
    const lower = vi.fn()
    const upper = vi.fn()
    const unregLower = registerSheetEscape(lower)
    const unregUpper = registerSheetEscape(upper)

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(upper).toHaveBeenCalledTimes(1)
    expect(lower).not.toHaveBeenCalled()

    unregUpper()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(lower).toHaveBeenCalledTimes(1)

    unregLower()
  })
})
