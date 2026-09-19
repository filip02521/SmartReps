import { test, expect } from '@playwright/test'
import { dismissAchievementUi } from './helpers/achievements'

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
        version: 5,
      }),
    )
  })
}

/** Reads the active free-workout session straight from IndexedDB so tests can
 * wait for persistence deterministically instead of racing the Dexie write. */
async function activeFreeSessionSets(page: import('@playwright/test').Page) {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onsuccess = () => {
          const db = req.result
          try {
            const tx = db.transaction('workoutSessions', 'readonly')
            const store = tx.objectStore('workoutSessions')
            const getAll = store.getAll()
            getAll.onsuccess = () => {
              const rows = (getAll.result as Array<{
                status: string
                program: string
                customPlanId?: string
                exerciseLogs?: Array<{ sets: unknown[] }>
              }>).filter(
                (s) => s.status === 'in_progress' && s.program === 'custom' && !s.customPlanId,
              )
              resolve(rows[0]?.exerciseLogs?.flatMap((l) => l.sets).length ?? 0)
            }
          } catch {
            resolve(-1)
          }
        }
        req.onerror = () => resolve(-1)
      }),
  )
}

test.describe('free (ad-hoc) workout', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarded(page)
    await dismissAchievementUi(page)
  })

  test('start from dashboard, add exercises and sets, finish, save as plan', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Trening swobodny').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Rozpocznij', exact: true }).click()
    await expect(page).toHaveURL(/\/workout\/free$/, { timeout: 15_000 })

    // Empty state — workout clock already running, quick-pick chips available
    await expect(page.getByText('Zaczynasz od zera')).toBeVisible()
    await page.getByRole('button', { name: 'Dodaj ćwiczenie' }).last().click()

    // Library sheet — pick a starter exercise
    const library = page.getByRole('dialog')
    await expect(library).toBeVisible()
    await library.getByRole('button', { name: 'Pompki' }).first().click()

    // Exercise card appears; log two sets
    const card = page.getByRole('region', { name: 'Pompki' })
    await expect(card).toBeVisible()
    await card.getByLabel('Powtórzenia').fill('12')
    await card.getByRole('button', { name: 'Dodaj serię' }).click()
    await expect(card.getByRole('button', { name: /Seria 1:/ })).toBeVisible()
    await card.getByRole('button', { name: 'Dodaj serię' }).click()
    await expect(card.getByRole('button', { name: /Seria 2:/ })).toBeVisible()

    // Rest pill appears after logging a set
    await expect(page.getByText('Przerwa').first()).toBeVisible({ timeout: 5_000 })

    // Reload — session resumes with logged sets intact. Wait for the async
    // Dexie persist to flush first so the reload can't race the write.
    await expect.poll(() => activeFreeSessionSets(page)).toBe(2)
    await page.reload()
    await expect(page.getByRole('region', { name: 'Pompki' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Seria 2:/ })).toBeVisible()

    // Add a second (weighted) exercise
    await page.getByRole('button', { name: 'Dodaj ćwiczenie' }).click()
    const lib2 = page.getByRole('dialog')
    await lib2.getByRole('button', { name: /Wyciskanie sztangi/ }).first().click()
    const card2 = page.getByRole('region', { name: /Wyciskanie sztangi/ })
    await expect(card2).toBeVisible()
    await card2.getByLabel('Powtórzenia').fill('8')
    await card2.getByLabel(/Ciężar/).fill('60')
    await card2.getByRole('button', { name: 'Dodaj serię' }).click()
    await expect(card2.getByRole('button', { name: /Seria 1:.*60/ })).toBeVisible()

    // Finish → summary
    await page.getByRole('button', { name: 'Zakończ' }).click()
    const confirm = page.getByRole('dialog')
    await confirm.getByRole('button', { name: 'Zakończ' }).click()
    await expect(page).toHaveURL(/\/workout\/free\/summary/, { timeout: 15_000 })
    await expect(page.getByText('Trening zaliczony')).toBeVisible()
    await expect(page.getByText('Wykonane ćwiczenia')).toBeVisible()

    // Save as reusable plan
    await page.getByRole('button', { name: 'Zapisz jako plan' }).click()
    const saveSheet = page.getByRole('dialog')
    await saveSheet.getByLabel('Nazwa planu').fill('E2E plan swobodny')
    await saveSheet.getByRole('button', { name: 'Zapisz jako plan' }).click()
    await expect(page.getByText('Plan zapisany').first()).toBeVisible({ timeout: 15_000 })

    // Plan exists in Moje
    await page.getByRole('button', { name: 'Otwórz Moje plany' }).click()
    await expect(page).toHaveURL(/\/plans\?tab=mine/)
    await expect(page.getByText('E2E plan swobodny')).toBeVisible({ timeout: 15_000 })
  })

  test('leave keeps session resumable; explicit discard abandons it', async ({ page }) => {
    await page.goto('/workout/free')
    await expect(page.getByText('Zaczynasz od zera')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Dodaj ćwiczenie' }).last().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Pompki' }).first().click()
    const card = page.getByRole('region', { name: 'Pompki' })
    await card.getByLabel('Powtórzenia').fill('10')
    await card.getByRole('button', { name: 'Dodaj serię' }).click()

    // Leave via back → confirm "Wyjdź" keeps the session resumable
    await page.getByRole('button', { name: 'Wstecz' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Wyjdź' }).click()
    await expect(page).toHaveURL('/', { timeout: 15_000 })

    // The global resume prompt surfaces the in-progress free workout
    const resumePrompt = page.getByRole('dialog')
    await expect(resumePrompt.getByText(/Trening swobodny · 1 ćw\./)).toBeVisible({ timeout: 15_000 })
    await resumePrompt.getByRole('button', { name: 'Wznów' }).click()
    await expect(page).toHaveURL(/\/workout\/free$/)
    await expect(page.getByRole('button', { name: /Seria 1:/ })).toBeVisible()

    // Leave again — this time discard explicitly
    await page.getByRole('button', { name: 'Wstecz' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Porzuć trening' }).click()
    await expect(page).toHaveURL('/', { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Rozpocznij', exact: true })).toBeVisible({ timeout: 15_000 })
  })

  test('finishing with no sets discards the workout', async ({ page }) => {
    await page.goto('/workout/free')
    await expect(page.getByText('Zaczynasz od zera')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Zakończ' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/porzucony/)).toBeVisible()
    await dialog.getByRole('button', { name: 'Porzuć sesję' }).click()
    await expect(page).toHaveURL('/', { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Rozpocznij', exact: true })).toBeVisible({ timeout: 15_000 })
  })
})
