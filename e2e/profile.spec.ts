import { test, expect, type Page } from '@playwright/test'

const AUTH_STORAGE_KEY = 'sb-pwfymoxjrgnovzcmmfyn-auth-token'

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
        dismissedHomeTipId: null,
        dismissedHomeTipDay: null,
        hasSeenLoginCloudPrompt: false,
        dismissedLoginBackupTip: false,
        lastSyncFailureReason: null,
        ...payload,
      },
      version: 4,
    }
    localStorage.setItem('smartreps-app', JSON.stringify(state))
  }, extras)
}

async function mockSupabaseAuth(page: Page, email = 'test@example.com') {
  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'e2e-user-1',
        email,
        aud: 'authenticated',
        role: 'authenticated',
      }),
    })
  })
  await page.route('**/auth/v1/logout**', async (route) => {
    await route.fulfill({ status: 204, body: '' })
  })
}

async function seedLoggedInProfile(page: Page) {
  await mockSupabaseAuth(page)
  await seedLocalAppState(page, { lastAuthUserId: 'e2e-user-1' })
  await page.addInitScript((authKey) => {
    const session = {
      access_token: 'fake-token',
      refresh_token: 'fake-refresh',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'e2e-user-1',
        email: 'test@example.com',
        aud: 'authenticated',
      },
    }
    localStorage.setItem(authKey, JSON.stringify(session))
  }, AUTH_STORAGE_KEY)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Wyloguj' })).toBeVisible({ timeout: 15_000 })
}

async function openProfile(page: Page) {
  await seedLocalAppState(page)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Profil' })).toBeVisible({ timeout: 20_000 })
}

test.describe('Profile data actions', () => {
  test('clear local data navigates to onboarding', async ({ page }) => {
    await openProfile(page)
    await page.getByRole('button', { name: 'Wyczyść lokalne dane' }).click()
    await page.getByRole('button', { name: 'Potwierdź' }).click()
    await expect(page).toHaveURL(/\/setup\/onboarding/, { timeout: 15_000 })
  })

  test('export buttons visible in data section', async ({ page }) => {
    await openProfile(page)
    await expect(page.getByRole('button', { name: 'Eksport CSV wszystkich programów' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Eksport backupu (JSON)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Import backupu' })).toBeVisible()
  })

  test('import sheet opens from data section', async ({ page }) => {
    await openProfile(page)
    await page.getByRole('button', { name: 'Import backupu' }).click()
    await expect(page.getByRole('heading', { name: 'Import backupu' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Importuj sesje (CSV)' })).toBeVisible()
  })

  test('logout keep data hides logout button', async ({ page }) => {
    await seedLoggedInProfile(page)
    await page.getByRole('button', { name: 'Wyloguj' }).click()
    await page.getByRole('button', { name: 'Wyloguj — zostaw dane' }).click()
    await expect(page.getByRole('button', { name: 'Wyloguj' })).toHaveCount(0, { timeout: 10_000 })
    await expect(page).toHaveURL(/\/profile/)
  })

  test('logout and clear navigates to onboarding', async ({ page }) => {
    await seedLoggedInProfile(page)
    await page.getByRole('button', { name: 'Wyloguj' }).click()
    await page.getByRole('button', { name: 'Wyloguj i wyczyść' }).click()
    await expect(page).toHaveURL(/\/setup\/onboarding/, { timeout: 15_000 })
  })
})
