import { test, expect } from '@playwright/test'

async function seedOnboarded(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'smartreps-app',
      JSON.stringify({
        state: {
          settings: {
            theme: 'system',
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
            enabledCustomPlanIds: [],
            customPlansFilterExplicit: false,
            onboardingComplete: true,
            displayName: 'Tester',
          },
          pendingTest: null,
          pendingStart: null,
          setupQueue: [],
          lastAuthUserId: null,
          enabledProgramsUpdatedAt: null,
          uiSettingsUpdatedAt: null,
          lastSyncedAt: null,
          hasCompletedFirstWorkout: true,
          hasDismissedInstallPrompt: true,
          hasSeenStandaloneLoginCoach: true,
          dismissedHomeTipId: null,
          dismissedHomeTipDay: null,
          hasSeenLoginCloudPrompt: false,
          dismissedLoginBackupTip: false,
          lastSyncFailureReason: null,
        },
        version: 0,
      }),
    )
  })
}

test.describe('community catalog', () => {
  test('plans tab shows community segment', async ({ page }) => {
    await seedOnboarded(page)
    await page.goto('/plans?tab=community')
    await expect(page.getByRole('heading', { name: 'Plany', exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Katalog' })).toBeVisible()
  })

  test('unknown community slug shows unavailable', async ({ page }) => {
    await seedOnboarded(page)
    await page.goto('/community/does-not-exist-zzzzzz')
    await expect(page.getByText('Plan niedostępny').first()).toBeVisible({ timeout: 15000 })
  })

  test('community detail has back navigation', async ({ page }) => {
    await seedOnboarded(page)
    await page.goto('/community/does-not-exist-zzzzzz')
    await expect(page.getByRole('button', { name: 'Wstecz' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Plan niedostępny').first()).toBeVisible()
  })
})
