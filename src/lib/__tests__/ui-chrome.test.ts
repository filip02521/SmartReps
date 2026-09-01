import { describe, expect, it } from 'vitest'
import {
  CHROME_BOTTOM_ABOVE_TABS,
  TAB_PAGE_SHELL,
  TOAST_BOTTOM_WITH_TABS,
  Z_SHEET,
  Z_TAB_BAR,
  Z_TOAST,
} from '@/lib/ui-chrome'

describe('ui-chrome', () => {
  it('keeps toast above sheets and tab bar', () => {
    expect(Z_TOAST).toBeGreaterThan(Z_SHEET)
    expect(Z_SHEET).toBeGreaterThan(Z_TAB_BAR)
  })

  it('shares tab-aware bottom offset for toast and PWA prompt', () => {
    expect(TOAST_BOTTOM_WITH_TABS).toBe(CHROME_BOTTOM_ABOVE_TABS)
    expect(TOAST_BOTTOM_WITH_TABS).toContain('safe-area-inset-bottom')
  })

  it('tab page shell prevents flex overflow clipping', () => {
    expect(TAB_PAGE_SHELL).toContain('w-full')
    expect(TAB_PAGE_SHELL).toContain('min-w-0')
  })
})
