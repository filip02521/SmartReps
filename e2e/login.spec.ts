import { test, expect, type Page } from '@playwright/test'

async function seedOnboarded(page: Page) {
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
          hasCompletedFirstWorkout: false,
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
}

async function seedProgramProgress(page: Page) {
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 20_000 })
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
  })
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('SmartRepsDB')
      req.onerror = () => reject(req.error ?? new Error('idb open failed'))
      req.onsuccess = () => {
        const idb = req.result
        const tx = idb.transaction('programProgress', 'readwrite')
        tx.objectStore('programProgress').put({
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
        tx.onerror = () => reject(tx.error ?? new Error('idb put failed'))
      }
    })
  })
}

test.describe('Login page (basic)', () => {
  test('shows email form and skip for local-only training', async ({ page }) => {
    await page.goto('/setup/login')
    await expect(page.getByRole('heading', { name: /Zapisz postęp w chmurze|Przywróć postęp/ })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByLabel(/E-mail/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pomiń — trenuję bez konta' })).toBeVisible()
  })

  test('skip navigates to dashboard when onboarded with progress', async ({ page }) => {
    await seedOnboarded(page)
    await seedProgramProgress(page)
    await page.goto('/setup/login')
    await page.getByRole('button', { name: 'Pomiń — trenuję bez konta' }).click()
    await expect(page).toHaveURL('/', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Wybierz trening' })).toBeVisible()
  })
})
