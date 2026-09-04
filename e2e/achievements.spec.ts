import { test, expect, type Page } from '@playwright/test'
import { dismissAchievementUi } from './helpers/achievements'

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
        version: 4,
      }),
    )
  })
}

async function waitForDexie(page: Page) {
  await page.waitForFunction(async () => {
    return await new Promise<boolean>((resolve) => {
      const req = indexedDB.open('SmartRepsDB')
      req.onerror = () => resolve(false)
      req.onsuccess = () => {
        const ok =
          req.result.objectStoreNames.contains('programProgress') &&
          req.result.objectStoreNames.contains('workoutSessions')
        req.result.close()
        resolve(ok)
      }
    })
  }, undefined, { timeout: 15_000 })
}

async function seedProgressAndSession(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Zacznij trening', { exact: true })).toBeVisible({
    timeout: 20_000,
  })
  await waitForDexie(page)

  await page.evaluate(async () => {
    const completedAt = new Date().toISOString()
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('SmartRepsDB')
      req.onerror = () => reject(req.error ?? new Error('idb open failed'))
      req.onsuccess = () => {
        const idb = req.result
        const tx = idb.transaction(['programProgress', 'workoutSessions'], 'readwrite')
        tx.objectStore('programProgress').put({
          program: 'pushups',
          cycleId: 'pushups-6-10',
          currentDay: 2,
          status: 'active',
          cycleAttempt: 1,
          lastWorkoutAt: completedAt,
          nextWorkoutAfter: null,
          updatedAt: completedAt,
        })
        tx.objectStore('workoutSessions').put({
          id: 'e2e-ach-session-1',
          program: 'pushups',
          cycleId: 'pushups-6-10',
          dayNumber: 1,
          cycleAttempt: 1,
          status: 'completed',
          startedAt: completedAt,
          completedAt,
          passed: true,
          totalReps: 40,
          setResults: [],
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

test.describe('achievements', () => {
  test('progress tab Odznaki shows gallery', async ({ page }) => {
    await seedOnboarded(page)
    await seedProgressAndSession(page)

    // Mark backfill done so we don't block on history sheet for this smoke.
    await page.evaluate(() => localStorage.setItem('achievements_backfill_v1', '1'))

    await page.goto('/progress?tab=achievements')
    await expect(page.getByRole('heading', { name: 'Postępy' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('tab', { name: 'Odznaki' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Przegląd' })).toBeVisible()
    await dismissAchievementUi(page)

    await expect(page.getByRole('tabpanel', { name: 'Postępy' })).toBeVisible()
    await expect(page.getByText('Pierwszy dzień').first()).toBeVisible({ timeout: 15_000 })

    await page.getByRole('tab', { name: 'Przegląd' }).click()
    await expect(page.getByRole('tab', { name: 'Przegląd' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Historia' })).toBeVisible()
  })

  test('completed session unlocks first_session sheet', async ({ page }) => {
    await seedOnboarded(page)
    await seedProgressAndSession(page)
    // Pretend backfill already ran — next unlock is a live sheet.
    await page.evaluate(() => localStorage.setItem('achievements_backfill_v1', '1'))

    await page.goto('/progress?tab=achievements')
    await expect(page.getByRole('heading', { name: 'Nowa odznaka' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('Pierwszy dzień').first()).toBeVisible()
    // May queue more (np. streak_1) — dismiss all unlock sheets.
    for (let i = 0; i < 6; i++) {
      const sheet = page.getByRole('heading', { name: 'Nowa odznaka' })
      if (!(await sheet.isVisible().catch(() => false))) break
      await page.getByRole('button', { name: 'Zamknij' }).click()
      await page.waitForTimeout(300)
    }
    await expect(page.getByRole('heading', { name: 'Nowa odznaka' })).not.toBeVisible()
  })

  test('community catalog shows Trenowany chip when trained_count > 0', async ({ page }) => {
    await seedOnboarded(page)

    await page.route('**/rest/v1/community_publications*', async (route) => {
      const row = {
        id: '11111111-1111-1111-1111-111111111111',
        author_id: '22222222-2222-2222-2222-222222222222',
        source_custom_plan_id: '33333333-3333-3333-3333-333333333333',
        slug: 'e2e-trained-plan',
        title: 'Plan z treningami',
        description: 'Opis testowy',
        tags: ['full_body'],
        snapshot_json: {
          schemaVersion: 1,
          name: 'Plan z treningami',
          description: 'Opis testowy',
          days: [{ dayNumber: 1, exercises: [] }],
          progression: null,
          deload: null,
          exercises: [],
        },
        author_display_name: 'Autor',
        like_count: 0,
        import_count: 2,
        trained_count: 3,
        content_version: 1,
        status: 'published',
        published_at: new Date().toISOString(),
        first_published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([row]),
      })
    })

    await page.goto('/plans?tab=community')
    await expect(page.getByRole('heading', { name: 'Plany', exact: true })).toBeVisible({
      timeout: 20_000,
    })
    await expect(page.getByText('Plan z treningami')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Trenowany')).toBeVisible()
  })
})
