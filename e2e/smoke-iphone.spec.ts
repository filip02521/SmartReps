import { test, expect, type Page } from '@playwright/test'

async function seedOnboardedWithProgress(page: Page) {
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
            onboardingComplete: true,
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
        version: 4,
      }),
    )
  })
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i }).or(page.getByText('O aplikacji')).first()).toBeVisible({
    timeout: 20_000,
  })
  await page.waitForFunction(async () => {
    return await new Promise<boolean>((resolve) => {
      const req = indexedDB.open('SmartRepsDB')
      req.onerror = () => resolve(false)
      req.onsuccess = () => {
        const ok = req.result.objectStoreNames.contains('programProgress')
        req.result.close()
        resolve(ok)
      }
    })
  }, undefined, { timeout: 15_000 })
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('SmartRepsDB')
      req.onerror = () => reject(req.error ?? new Error('idb open failed'))
      req.onsuccess = () => {
        const idb = req.result
        const tx = idb.transaction('programProgress', 'readwrite')
        const store = tx.objectStore('programProgress')
        store.put({
          program: 'pushups',
          cycleId: 'pushups-6-10',
          currentDay: 1,
          status: 'active',
          cycleAttempt: 1,
          lastWorkoutAt: null,
          nextWorkoutAfter: null,
          updatedAt: new Date().toISOString(),
        })
        tx.oncomplete = () => {
          idb.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  })
}

test.describe('iPhone SE smoke', () => {
  test('onboarding welcome fits viewport', async ({ page }) => {
    await page.goto('/setup/onboarding')
    await expect(page.getByRole('heading', { name: 'Witaj w SmartReps' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('button', { name: 'Pierwszy raz — skonfiguruj program' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    )
    expect(overflow).toBe(true)
  })

  test('seeded dashboard home renders core chrome', async ({ page }) => {
    await seedOnboardedWithProgress(page)
    await page.goto('/')
    await expect(page.getByRole('img', { name: 'SmartReps' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Wybierz trening' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('navigation', { name: 'Główna nawigacja' })).toBeVisible()
  })

  test('privacy page loads without onboarding gate', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Polityka prywatności' })).toBeVisible({
      timeout: 15_000,
    })
  })
})
