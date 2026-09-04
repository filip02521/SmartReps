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

test.describe('custom plans smoke', () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarded(page)
  })

  test('plans mine tab opens library and new plan editor hub', async ({ page }) => {
    await page.goto('/plans?tab=mine')
    await expect(page.getByRole('tab', { name: 'Moje' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('tab', { name: 'Biblioteka' }).click()
    await expect(page.getByRole('tab', { name: 'Biblioteka', selected: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dodaj ćwiczenie' })).toBeVisible()
    await page.getByRole('tab', { name: 'Moje' }).click()
    await page.getByRole('button', { name: 'Nowy plan' }).first().click()
    await expect(page.getByLabel('Nazwa planu')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dodaj dzień' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zapisz i aktywuj' })).toBeVisible()
  })

  test('create draft plan with name appears on Moje list', async ({ page }) => {
    await page.goto('/plans?tab=mine')
    await expect(page.getByRole('tab', { name: 'Moje' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Nowy plan' }).first().click()
    const name = `E2E plan ${Date.now()}`
    await page.getByLabel('Nazwa planu').fill(name)
    await page.getByRole('button', { name: 'Zapisz szkic' }).click()
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 })
  })

  test('closing editor after typing name saves draft to list', async ({ page }) => {
    await page.goto('/plans?tab=mine')
    await expect(page.getByRole('tab', { name: 'Moje' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Nowy plan' }).first().click()
    const name = `E2E close ${Date.now()}`
    await page.getByLabel('Nazwa planu').fill(name)
    await page.getByRole('button', { name: 'Zamknij' }).click()
    await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 })
  })

  test('default exercises are present in library on first open', async ({ page }) => {
    await page.goto('/plans?tab=library')
    await expect(page.getByRole('tab', { name: 'Biblioteka' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Pompki', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Przysiady', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Dodaj zestaw startowy' })).toHaveCount(0)
  })

  test('merges duplicate exercises in library by name', async ({ page }) => {
    await page.goto('/plans?tab=library')
    await expect(page.getByText('Pompki', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

    await page.evaluate(async () => {
      const now = new Date().toISOString()
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onerror = () => reject(req.error ?? new Error('idb open failed'))
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('exercises', 'readwrite')
          tx.objectStore('exercises').put({
            id: crypto.randomUUID(),
            name: ' pompki ',
            primaryMetric: 'reps',
            restDefaultSec: 90,
            archived: false,
            createdAt: now,
            updatedAt: now,
          })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error ?? new Error('idb seed failed'))
        }
      })
    })

    await page.getByRole('tab', { name: 'Moje' }).click()
    await page.getByRole('tab', { name: 'Biblioteka' }).click()
    await expect(page.getByText('Pompki', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pompki', { exact: true })).toHaveCount(1)
  })

  test('custom workout completes a single-set day', async ({ page }) => {
    test.setTimeout(60_000)

    await page.goto('/profile')
    await expect(page.getByText('O aplikacji').or(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i })).first()).toBeVisible({
      timeout: 20_000,
    })

    const ids = await page.evaluate(async () => {
      const planId = crypto.randomUUID()
      const exerciseId = crypto.randomUUID()
      const now = new Date().toISOString()
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onerror = () => reject(req.error ?? new Error('idb open failed'))
        req.onsuccess = () => {
          const idb = req.result
          const stores = [
            'exercises',
            'customPlans',
            'customProgramProgress',
          ] as const
          for (const name of stores) {
            if (!idb.objectStoreNames.contains(name)) {
              idb.close()
              reject(new Error(`${name} missing`))
              return
            }
          }
          const tx = idb.transaction(stores, 'readwrite')
          tx.objectStore('exercises').put({
            id: exerciseId,
            name: 'E2E Pompki',
            primaryMetric: 'reps',
            restDefaultSec: 60,
            archived: false,
            createdAt: now,
            updatedAt: now,
          })
          tx.objectStore('customPlans').put({
            id: planId,
            name: 'E2E trening',
            description: '',
            status: 'active',
            source: 'user',
            createdAt: now,
            updatedAt: now,
            days: [
              {
                dayNumber: 1,
                restAfterDay: 1,
                exercises: [
                  {
                    exerciseId,
                    order: 0,
                    restBetweenSetsSec: 60,
                    sets: [{ reps: { kind: 'fixed', value: 5 } }],
                  },
                ],
              },
            ],
          })
          tx.objectStore('customProgramProgress').put({
            customPlanId: planId,
            currentDay: 1,
            status: 'active',
            cycleAttempt: 1,
            lastWorkoutAt: null,
            nextWorkoutAfter: null,
            updatedAt: now,
          })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error ?? new Error('idb seed failed'))
        }
      })
      return { planId, exerciseId }
    })

    await page.goto('/plans?tab=mine')
    await expect(page.getByText('E2E trening')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Trenuj' }).click()
    // Preview sheet opens first — click "Rozpocznij trening" to start.
    await expect(page.getByRole('heading', { name: 'Podgląd treningu' })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('button', { name: 'Rozpocznij trening' }).click()
    await expect(page).toHaveURL(new RegExp(`/workout/custom/${ids.planId}`), { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Zrobione' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Zrobione' }).click()
    await expect(page.getByText('Dzień zaliczony').or(page.getByText('Dzień niezaliczony'))).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page
        .getByText('Zrób zaplanowaną przerwę')
        .or(page.getByText('Ten sam dzień czeka'))
        .or(page.getByText(/Następny trening/i)),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zobacz postępy' })).toBeVisible()
  })

  test('resume label appears when active custom workout has progress', async ({ page }) => {
    test.setTimeout(60_000)
    const planId = 'e2e-resume-plan'
    const exerciseId = 'e2e-resume-ex'
    const sessionId = 'e2e-resume-session'

    await page.goto('/profile')
    await expect(page.getByText('O aplikacji').or(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i })).first()).toBeVisible({
      timeout: 20_000,
    })

    await page.evaluate(
      async ({ planId: pid, exerciseId: eid, sessionId: sid }) => {
        const now = new Date().toISOString()
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('SmartRepsDB')
          req.onerror = () => reject(req.error ?? new Error('idb open failed'))
          req.onsuccess = () => {
            const idb = req.result
            const stores = [
              'exercises',
              'customPlans',
              'customProgramProgress',
              'workoutSessions',
              'activeCustomWorkout',
            ] as const
            for (const name of stores) {
              if (!idb.objectStoreNames.contains(name)) {
                idb.close()
                reject(new Error(`${name} missing`))
                return
              }
            }
            const tx = idb.transaction(stores, 'readwrite')
            tx.objectStore('exercises').put({
              id: eid,
              name: 'E2E Deska',
              primaryMetric: 'reps',
              restDefaultSec: 60,
              archived: false,
              createdAt: now,
              updatedAt: now,
            })
            tx.objectStore('customPlans').put({
              id: pid,
              name: 'E2E resume',
              description: '',
              status: 'active',
              source: 'user',
              createdAt: now,
              updatedAt: now,
              days: [
                {
                  dayNumber: 1,
                  restAfterDay: 1,
                  exercises: [
                    {
                      exerciseId: eid,
                      order: 0,
                      restBetweenSetsSec: 60,
                      sets: [
                        { reps: { kind: 'fixed', value: 5 } },
                        { reps: { kind: 'fixed', value: 5 } },
                      ],
                    },
                  ],
                },
              ],
            })
            tx.objectStore('customProgramProgress').put({
              customPlanId: pid,
              currentDay: 1,
              status: 'active',
              cycleAttempt: 1,
              lastWorkoutAt: null,
              nextWorkoutAfter: null,
              updatedAt: now,
            })
            tx.objectStore('workoutSessions').put({
              id: sid,
              program: 'custom',
              programKind: 'custom',
              customPlanId: pid,
              cycleId: pid,
              dayNumber: 1,
              cycleAttempt: 1,
              status: 'in_progress',
              startedAt: now,
              setResults: [],
              exerciseLogs: [
                {
                  exerciseId: eid,
                  order: 0,
                  sets: [
                    {
                      setNumber: 1,
                      passed: true,
                      actual: { reps: 5 },
                      prescription: { reps: { kind: 'fixed', value: 5 } },
                    },
                  ],
                },
              ],
            })
            tx.objectStore('activeCustomWorkout').put({
              customPlanId: pid,
              sessionId: sid,
              currentExerciseIndex: 0,
              currentSetIndex: 1,
              exerciseLogs: [
                {
                  exerciseId: eid,
                  order: 0,
                  sets: [
                    {
                      setNumber: 1,
                      passed: true,
                      actual: { reps: 5 },
                      prescription: { reps: { kind: 'fixed', value: 5 } },
                    },
                  ],
                },
              ],
              restTimerJson: null,
              updatedAt: now,
            })
            tx.oncomplete = () => {
              idb.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error ?? new Error('idb seed failed'))
          }
        })
      },
      { planId, exerciseId, sessionId },
    )

    await page.goto('/plans?tab=mine')
    await expect(page.getByRole('button', { name: 'Kontynuuj Dzień 1 — seria 2/2' })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('imports plan from JSON file', async ({ page }) => {
    const planName = `E2E import ${Date.now()}`
    const payload = {
      name: planName,
      description: '',
      days: [
        {
          dayNumber: 1,
          restAfterDay: 1,
          exercises: [],
        },
      ],
    }

    await page.goto('/plans?tab=mine')
    await expect(page.getByRole('tab', { name: 'Moje' })).toBeVisible({ timeout: 15_000 })

    const input = page.locator('input[type="file"][accept*="json"]')
    await input.setInputFiles({
      name: 'plan.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(payload)),
    })

    await expect(page.getByLabel('Nazwa planu')).toHaveValue(planName, { timeout: 15_000 })
  })

  test('multi-exercise day advances through both exercises', async ({ page }) => {
    test.setTimeout(90_000)

    await page.goto('/profile')
    await expect(
      page
        .getByText('O aplikacji')
        .or(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i }))
        .first(),
    ).toBeVisible({ timeout: 20_000 })

    const ids = await page.evaluate(async () => {
      const planId = crypto.randomUUID()
      const ex1 = crypto.randomUUID()
      const ex2 = crypto.randomUUID()
      const now = new Date().toISOString()
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onerror = () => reject(req.error ?? new Error('idb open failed'))
        req.onsuccess = () => {
          const idb = req.result
          const stores = ['exercises', 'customPlans', 'customProgramProgress'] as const
          const tx = idb.transaction(stores, 'readwrite')
          tx.objectStore('exercises').put({
            id: ex1,
            name: 'E2E A',
            primaryMetric: 'reps',
            restDefaultSec: 0,
            archived: false,
            createdAt: now,
            updatedAt: now,
          })
          tx.objectStore('exercises').put({
            id: ex2,
            name: 'E2E B',
            primaryMetric: 'reps',
            restDefaultSec: 0,
            archived: false,
            createdAt: now,
            updatedAt: now,
          })
          tx.objectStore('customPlans').put({
            id: planId,
            name: 'E2E multi',
            description: '',
            status: 'active',
            source: 'user',
            createdAt: now,
            updatedAt: now,
            days: [
              {
                dayNumber: 1,
                restAfterDay: 1,
                exercises: [
                  {
                    exerciseId: ex1,
                    order: 0,
                    restBetweenSetsSec: 0,
                    sets: [{ reps: { kind: 'fixed', value: 3 } }],
                  },
                  {
                    exerciseId: ex2,
                    order: 1,
                    restBetweenSetsSec: 0,
                    sets: [{ reps: { kind: 'fixed', value: 3 } }],
                  },
                ],
              },
            ],
          })
          tx.objectStore('customProgramProgress').put({
            customPlanId: planId,
            currentDay: 1,
            status: 'active',
            cycleAttempt: 1,
            lastWorkoutAt: null,
            nextWorkoutAfter: null,
            updatedAt: now,
          })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error ?? new Error('idb seed failed'))
        }
      })
      return { planId }
    })

    await page.goto(`/workout/custom/${ids.planId}`)
    await expect(page.getByRole('button', { name: 'Statystyki: E2E A' })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: 'Zrobione' }).click()
    await expect(page.getByRole('button', { name: 'Statystyki: E2E B' })).toBeVisible({
      timeout: 15_000,
    })
    await page.getByRole('button', { name: 'Zrobione' }).click()
    await expect(page.getByText('Dzień zaliczony').or(page.getByText('Dzień niezaliczony'))).toBeVisible({
      timeout: 20_000,
    })
    await expect(
      page
        .getByText('Zrób zaplanowaną przerwę')
        .or(page.getByText('Ten sam dzień czeka'))
        .or(page.getByText(/Następny trening/i)),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Zobacz postępy' })).toBeVisible()
  })

  test('editor shows exercise note field', async ({ page }) => {
    await page.goto('/plans?tab=mine')
    await expect(page.getByRole('tab', { name: 'Moje' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Nowy plan' }).first().click()
    await page.getByLabel('Nazwa planu').fill(`E2E note ${Date.now()}`)
    await page.getByRole('button', { name: 'Dodaj dzień' }).click()
    await page.getByRole('button', { name: /Dzień 1/ }).click()
    await page.getByRole('button', { name: 'Dodaj ćwiczenie' }).click()
    await page.getByRole('button', { name: 'Pompki' }).first().click()
    await expect(page.getByLabel('Notatka (opcjonalnie)')).toBeVisible({ timeout: 10_000 })
  })

  test('paused plan shows resume instead of train on plans list', async ({ page }) => {
    const planId = 'e2e-paused-plan'
    await page.goto('/profile')
    await expect(
      page
        .getByText('O aplikacji')
        .or(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i }))
        .first(),
    ).toBeVisible({ timeout: 20_000 })

    await page.evaluate(async (pid) => {
      const now = new Date().toISOString()
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onerror = () => reject(req.error ?? new Error('idb open failed'))
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(['customPlans', 'customProgramProgress'], 'readwrite')
          tx.objectStore('customPlans').put({
            id: pid,
            name: 'E2E paused',
            description: '',
            status: 'active',
            source: 'user',
            createdAt: now,
            updatedAt: now,
            days: [
              {
                dayNumber: 1,
                restAfterDay: 1,
                exercises: [],
              },
            ],
          })
          tx.objectStore('customProgramProgress').put({
            customPlanId: pid,
            currentDay: 1,
            status: 'paused',
            cycleAttempt: 1,
            lastWorkoutAt: null,
            nextWorkoutAfter: null,
            updatedAt: now,
          })
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error ?? new Error('idb seed failed'))
        }
      })
    }, planId)

    await page.goto('/plans?tab=mine')
    await expect(page.getByText('E2E paused')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Wznów plan' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Trenuj' })).toHaveCount(0)
  })

  test('progress custom history opens session summary', async ({ page }) => {
    test.setTimeout(60_000)
    const planId = `e2e-hist-${Date.now()}`
    const sessionId = `e2e-hist-session-${Date.now()}`

    await page.goto('/profile')
    await expect(
      page.getByText('O aplikacji').or(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i })).first(),
    ).toBeVisible({ timeout: 20_000 })

    await page.evaluate(
      async ({ planId: pid, sessionId: sid }) => {
        const now = new Date().toISOString()
        const exerciseId = crypto.randomUUID()
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('SmartRepsDB')
          req.onerror = () => reject(req.error ?? new Error('idb open failed'))
          req.onsuccess = () => {
            const idb = req.result
            const tx = idb.transaction(
              ['exercises', 'customPlans', 'customProgramProgress', 'workoutSessions'],
              'readwrite',
            )
            tx.objectStore('exercises').put({
              id: exerciseId,
              name: 'E2E hist',
              primaryMetric: 'reps',
              restDefaultSec: 60,
              archived: false,
              createdAt: now,
              updatedAt: now,
            })
            tx.objectStore('customPlans').put({
              id: pid,
              name: 'E2E history plan',
              description: '',
              status: 'active',
              source: 'user',
              createdAt: now,
              updatedAt: now,
              days: [
                {
                  dayNumber: 1,
                  restAfterDay: 1,
                  exercises: [
                    {
                      exerciseId,
                      order: 0,
                      restBetweenSetsSec: 60,
                      sets: [{ reps: { kind: 'fixed', value: 5 } }],
                    },
                  ],
                },
              ],
            })
            tx.objectStore('customProgramProgress').put({
              customPlanId: pid,
              currentDay: 1,
              status: 'rest',
              cycleAttempt: 1,
              lastWorkoutAt: now,
              nextWorkoutAfter: now,
              updatedAt: now,
            })
            tx.objectStore('workoutSessions').put({
              id: sid,
              program: 'custom',
              programKind: 'custom',
              customPlanId: pid,
              cycleId: `custom:${pid}`,
              cycleAttempt: 1,
              dayNumber: 1,
              status: 'completed',
              passed: false,
              startedAt: now,
              completedAt: now,
              setResults: [],
              exerciseLogs: [
                {
                  exerciseId,
                  order: 0,
                  sets: [
                    {
                      setNumber: 1,
                      passed: false,
                      actual: { reps: 3 },
                      prescription: { reps: { kind: 'fixed', value: 5 } },
                    },
                  ],
                },
              ],
            })
            tx.oncomplete = () => {
              idb.close()
              resolve()
            }
            tx.onerror = () => reject(tx.error ?? new Error('idb seed failed'))
          }
        })
      },
      { planId, sessionId },
    )

    await page.goto('/progress?tab=history')
    await dismissAchievementUi(page)
    // Filter to custom sessions only
    await page.getByRole('tab', { name: 'Własne' }).click()
    await expect(page.getByText('E2E history plan')).toBeVisible({ timeout: 15_000 })
    await page.getByText('E2E history plan').click()
    // Detail sheet opens — navigate to full summary
    await expect(page.getByText('Szczegóły sesji')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Pełne podsumowanie' }).click()
    await expect(page.getByText('Dzień niezaliczony')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Powtórz dzień' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Udostępnij wynik' })).toHaveCount(0)
  })

  test('3-day cycle completes and resets to day 1', async ({ page }) => {
    test.setTimeout(120_000)

    await page.goto('/profile')
    await expect(
      page.getByText('O aplikacji').or(page.getByRole('heading', { name: /Profil|Konto|Wygląd/i })).first(),
    ).toBeVisible({ timeout: 20_000 })

    const ids = await page.evaluate(async () => {
      const planId = crypto.randomUUID()
      const exerciseId = crypto.randomUUID()
      const now = new Date().toISOString()
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onerror = () => reject(req.error ?? new Error('idb open failed'))
        req.onsuccess = () => {
          const idb = req.result
          const stores = ['exercises', 'customPlans', 'customProgramProgress'] as const
          for (const name of stores) {
            if (!idb.objectStoreNames.contains(name)) {
              idb.close()
              reject(new Error(`${name} missing`))
              return
            }
          }
          const tx = idb.transaction(stores, 'readwrite')
          tx.objectStore('exercises').put({
            id: exerciseId,
            name: 'E2E Pompki',
            primaryMetric: 'reps',
            restDefaultSec: 60,
            archived: false,
            createdAt: now,
            updatedAt: now,
          })
          tx.objectStore('customPlans').put({
            id: planId,
            name: 'E2E 3-day cycle',
            description: '',
            status: 'active',
            source: 'user',
            createdAt: now,
            updatedAt: now,
            days: [
              { dayNumber: 1, restAfterDay: 0, exercises: [{ exerciseId, order: 0, restBetweenSetsSec: 60, sets: [{ reps: { kind: 'fixed', value: 5 } }] }] },
              { dayNumber: 2, restAfterDay: 0, exercises: [{ exerciseId, order: 0, restBetweenSetsSec: 60, sets: [{ reps: { kind: 'fixed', value: 6 } }] }] },
              { dayNumber: 3, restAfterDay: 0, exercises: [{ exerciseId, order: 0, restBetweenSetsSec: 60, sets: [{ reps: { kind: 'fixed', value: 7 } }] }] },
            ],
          })
          tx.objectStore('customProgramProgress').put({
            customPlanId: planId,
            currentDay: 3,
            status: 'active',
            cycleAttempt: 1,
            lastWorkoutAt: null,
            nextWorkoutAfter: null,
            updatedAt: now,
          })
          tx.oncomplete = () => { idb.close(); resolve() }
          tx.onerror = () => reject(tx.error ?? new Error('idb seed failed'))
        }
      })
      return { planId, exerciseId }
    })

    // Start day 3 directly (bypass preview by navigating to URL).
    await page.goto(`/workout/custom/${ids.planId}`)
    await expect(page.getByRole('button', { name: 'Zrobione' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Zrobione' }).click()

    // Summary should show day passed.
    await expect(page.getByText('Dzień zaliczony').or(page.getByText('Dzień niezaliczony'))).toBeVisible({
      timeout: 20_000,
    })

    // Navigate to plans and verify day reset to 1.
    await page.goto('/plans?tab=mine')
    await expect(page.getByText('E2E 3-day cycle')).toBeVisible({ timeout: 15_000 })
    // Verify progress in DB — should be cycle_complete with currentDay=1.
    const progress = await page.evaluate(async (pid: string) => {
      return new Promise<{ status: string; currentDay: number }>((resolve, reject) => {
        const req = indexedDB.open('SmartRepsDB')
        req.onerror = () => reject(req.error ?? new Error('idb open failed'))
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('customProgramProgress', 'readonly')
          const store = tx.objectStore('customProgramProgress')
          const idx = store.index('customPlanId')
          const r = idx.get(pid)
          r.onsuccess = () => {
            idb.close()
            resolve({ status: r.result?.status ?? 'NOT_FOUND', currentDay: r.result?.currentDay ?? -1 })
          }
          r.onerror = () => reject(r.error ?? new Error('get failed'))
        }
      })
    }, ids.planId)
    console.log('DEBUG progress:', progress)
    expect(progress.status).toBe('cycle_complete')
    expect(progress.currentDay).toBe(1)
  })
})
