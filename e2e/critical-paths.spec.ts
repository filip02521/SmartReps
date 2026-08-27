import { test, expect, type Page } from '@playwright/test'

async function seedLocalAppState(page: Page, extras: Record<string, unknown> = {}) {
  await page.addInitScript((payload) => {
    const state = {
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
        ...payload,
      },
      version: 0,
    }
    localStorage.setItem('smartreps-app', JSON.stringify(state))
  }, extras)
}

/**
 * After the SPA has opened Dexie (any app route that imports db), upsert program progress.
 */
async function upsertProgramProgress(
  page: Page,
  opts?: { status?: string; cycleId?: string; currentDay?: number },
) {
  const status = opts?.status ?? 'active'
  const cycleId = opts?.cycleId ?? 'pushups-6-10'
  const currentDay = opts?.currentDay ?? 1

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

  await page.evaluate(
    async ({ status: st, cycleId: cid, currentDay: day }) => {
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onerror = () => reject(req.error ?? new Error('idb open failed'))
        req.onsuccess = () => {
          const idb = req.result
          if (!idb.objectStoreNames.contains('programProgress')) {
            idb.close()
            reject(new Error('programProgress missing — open an app route first'))
            return
          }
          const tx = idb.transaction('programProgress', 'readwrite')
          const store = tx.objectStore('programProgress')
          const index = store.indexNames.contains('program') ? store.index('program') : null
          const finishPut = (existing?: { id?: number }) => {
            store.put({
              ...(existing?.id != null ? { id: existing.id } : {}),
              program: 'pushups',
              cycleId: cid,
              currentDay: day,
              status: st,
              cycleAttempt: 1,
              lastWorkoutAt: null,
              nextWorkoutAfter: null,
              updatedAt: new Date().toISOString(),
            })
          }
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error ?? new Error('idb put failed'))
          if (index) {
            const getReq = index.get('pushups')
            getReq.onsuccess = () => finishPut(getReq.result as { id?: number } | undefined)
            getReq.onerror = () => finishPut()
          } else {
            finishPut()
          }
        }
      })
    },
    { status, cycleId, currentDay },
  )
}

/** Open Dexie via a route that imports db (privacy doesn't), then seed progress. */
async function seedOnboardedWithProgress(
  page: Page,
  opts?: { status?: string; cycleId?: string; currentDay?: number },
) {
  await seedLocalAppState(page)
  // Profile is lazy but pulls sync/db; login always imports auth-sync → db.
  // Hit /profile through RequireOnboarding — with onboardingComplete this loads AppLayout + Profile.
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i }).or(page.getByText('O aplikacji')).first()).toBeVisible({
    timeout: 20_000,
  })
  await upsertProgramProgress(page, opts)
}

test.describe('SmartReps routing critical paths', () => {
  test('1) onboarding → test → cycle → start → workout', async ({ page }) => {
    test.setTimeout(90_000)
    await page.goto('/setup/onboarding')
    await expect(page.getByRole('heading', { name: 'Witaj w SmartReps' })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: 'Pierwszy raz — skonfiguruj program' }).click()
    await page.getByRole('button', { name: 'Dalej' }).click()
    await page.getByRole('button', { name: 'Wykonaj test' }).click()

    await expect(page).toHaveURL(/\/setup\/test\/pushups/)
    await page.getByRole('checkbox', { name: 'Rozumiem i chcę kontynuować' }).check()
    await page.getByRole('button', { name: 'Potwierdź' }).click()

    for (const label of ['Wymachy ramion', 'Skręty tułowia', '10 lekkich pompek']) {
      await page.getByRole('checkbox', { name: label }).check()
    }
    for (let i = 0; i < 12; i += 1) {
      await page.getByRole('button', { name: 'Więcej' }).click()
    }
    await page.getByRole('button', { name: 'Dalej — wybierz cykl' }).click()

    await expect(page).toHaveURL(/\/setup\/cycle\/pushups/)
    await page.getByRole('button', { name: /Wybierz ten poziom/ }).click()

    await expect(page).toHaveURL(/\/setup\/start\/pushups/)
    await page.getByRole('button', { name: 'Rozpocznij Dzień 1' }).click()

    await expect(page).toHaveURL(/\/setup\/login/)
    await page.getByRole('button', { name: 'Pomiń — trenuję bez konta' }).click()

    await expect(page).toHaveURL(/\/workout\/pushups/, { timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Zrobione' })).toBeVisible({ timeout: 15_000 })
  })

  test('2) login skip (onboarded) → Dashboard home', async ({ page }) => {
    await seedOnboardedWithProgress(page)
    await page.goto('/setup/login')
    await page.getByRole('button', { name: 'Pomiń — trenuję bez konta' }).click()
    await expect(page).toHaveURL('/', { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: 'Trening' })).toBeVisible()
  })

  test('3) workout Done → rest → edit previous → finish → summary', async ({ page }) => {
    test.setTimeout(120_000)
    await seedOnboardedWithProgress(page)
    await page.goto('/workout/pushups?force=1')

    await expect(page.getByRole('button', { name: 'Zrobione' })).toBeVisible({ timeout: 20_000 })

    // Set 1
    await page.getByRole('button', { name: 'Zrobione' }).click()
    await expect(page.getByText(/przerwa|odpoczynek|sek/i).first()).toBeVisible({ timeout: 10_000 })

    // Skip rest (confirm sheet)
    await page.getByRole('button', { name: 'Pomiń' }).click()
    const confirmSkip = page.getByRole('button', { name: 'Pomiń' }).last()
    if (await confirmSkip.isVisible().catch(() => false)) {
      await confirmSkip.click()
    }

    // Edit previous if offered
    const editPrev = page.getByRole('button', { name: 'Popraw poprzednią serię' })
    if (await editPrev.isVisible().catch(() => false)) {
      await editPrev.click()
      await page.getByRole('button', { name: 'Zrobione' }).click()
      const skipAgain = page.getByRole('button', { name: 'Pomiń' })
      if (await skipAgain.isVisible().catch(() => false)) {
        await skipAgain.click()
        const confirm = page.getByRole('button', { name: 'Pomiń' }).last()
        if (await confirm.isVisible().catch(() => false)) await confirm.click()
      }
    }

    // Finish remaining sets
    for (let i = 0; i < 10; i += 1) {
      if (page.url().includes('/summary')) break
      const done = page.getByRole('button', { name: 'Zrobione' })
      if (!(await done.isVisible().catch(() => false))) break
      await done.click()
      const skip = page.getByRole('button', { name: 'Pomiń' })
      if (await skip.isVisible().catch(() => false)) {
        await skip.click()
        const confirm = page.getByRole('button', { name: 'Pomiń' }).last()
        if (await confirm.isVisible().catch(() => false)) await confirm.click()
      }
    }

    await expect(page).toHaveURL(/\/workout\/pushups\/summary/, { timeout: 30_000 })
  })

  test('4) level-change ?change=1 → confirm → day 1 on Dashboard', async ({ page }) => {
    test.setTimeout(60_000)
    await seedOnboardedWithProgress(page, { cycleId: 'pushups-11-20', currentDay: 3 })
    await page.goto('/setup/cycle/pushups?change=1')
    await expect(page).toHaveURL(/change=1/)

    // Level-change CTA uses "Zacznij od dnia 1" (or pickLevel wording)
    const cta = page.getByRole('button', { name: /Zrestartuj od dnia 1|Wybierz ten poziom/ }).first()
    await expect(cta).toBeVisible({ timeout: 15_000 })
    await cta.click()

    // Higher-level warning sheet
    const understandHigher = page.getByRole('button', { name: 'Rozumiem, zaczynam wyżej' })
    if (await understandHigher.isVisible().catch(() => false)) {
      await understandHigher.click()
    }

    if (page.url().includes('/setup/start/')) {
      await page.getByRole('button', { name: /Rozpocznij Dzień 1|Kontynuuj/ }).click()
      if (page.url().includes('/setup/login')) {
        await page.getByRole('button', { name: 'Pomiń — trenuję bez konta' }).click()
      }
    }

    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Trening' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Rozpocznij Dzień 1/ })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('5) /privacy without onboarding; / still gated', async ({ page }) => {
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'Polityka prywatności' })).toBeVisible()

    await page.goto('/')
    await expect(page).toHaveURL(/\/setup\/onboarding/)
  })
})
