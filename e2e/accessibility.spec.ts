import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Accessibility smoke tests using axe-core.
 * Scans the main pages for WCAG 2.1 AA violations.
 * Checks both critical and serious impact levels in light and dark modes.
 * These are regression tests — failures indicate a11y regressions.
 */

// Helper: filter violations by impact level
function criticalAndSerious(violations: { impact: string | null }[]) {
  return violations.filter((v) => v.impact === 'critical' || v.impact === 'serious')
}

// Helper: seed localStorage with given theme and onboarding state
function seedState(opts: { theme: string; onboardingComplete?: boolean }) {
  return () => {
    const state = {
      state: {
        settings: {
          theme: opts.theme,
          highContrast: false,
          timerSound: false,
          timerVibration: false,
          workoutReminders: false,
          pushNotifications: false,
          reminderHour: 18,
          keepScreenOn: true,
          healthDisclaimerAccepted: true,
          hasSeenWorkoutHint: true,
          enabledPrograms: ['pushups'],
          onboardingComplete: opts.onboardingComplete ?? true,
        },
      },
      version: 0,
    }
    localStorage.setItem('smartreps-app', JSON.stringify(state))
  }
}

// Helper: run axe scan on a page and assert no critical/serious violations
async function expectNoA11yViolations(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .exclude('#sr-splash')
    .analyze()
  const failing = criticalAndSerious(results.violations)
  expect(failing).toEqual([])
}

const PAGES: Array<{ name: string; path: string; onboarding?: boolean }> = [
  { name: 'Dashboard', path: '/' },
  { name: 'Onboarding', path: '/setup/onboarding', onboarding: true },
  { name: 'Progress', path: '/progress' },
  { name: 'Plans', path: '/plans' },
  { name: 'Profile', path: '/profile' },
]

test.describe('Accessibility (axe-core) — Light mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedState({ theme: 'light' }))
  })

  for (const { name, path, onboarding } of PAGES) {
    test(`${name} has no critical or serious a11y violations`, async ({ page }) => {
      if (onboarding) {
        await page.addInitScript(seedState({ theme: 'light', onboardingComplete: false }))
      }
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expectNoA11yViolations(page)
    })
  }

  test('Dashboard — keyboard navigation reaches main buttons', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Tab')
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
    expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA']).toContain(focusedTag ?? '')
  })
})

test.describe('Accessibility (axe-core) — Dark mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedState({ theme: 'dark' }))
  })

  for (const { name, path, onboarding } of PAGES) {
    test(`${name} (dark) has no critical or serious a11y violations`, async ({ page }) => {
      if (onboarding) {
        await page.addInitScript(seedState({ theme: 'dark', onboardingComplete: false }))
      }
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expectNoA11yViolations(page)
    })
  }
})
