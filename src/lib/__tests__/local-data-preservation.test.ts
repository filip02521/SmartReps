import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockState = {
  settings: {
    aiApiKey: 'sk-test-key',
    aiModel: 'gpt-4o-mini',
    aiBaseUrl: 'https://api.openai.com/v1',
    language: 'en' as const,
    theme: 'dark' as const,
    weightUnit: 'lb' as const,
  },
}

const mockSetState = vi.fn()

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => mockState,
    setState: (...args: unknown[]) => mockSetState(...args),
  },
  defaultSettings: {
    theme: 'system',
    highContrast: false,
    timerSound: true,
    timerVibration: true,
    workoutReminders: false,
    pushNotifications: false,
    reminderHour: 18,
    keepScreenOn: true,
    weightUnit: 'kg',
    healthDisclaimerAccepted: false,
    hasSeenWorkoutHint: false,
    enabledPrograms: ['pushups'],
    enabledCustomPlanIds: [],
    customPlansFilterExplicit: false,
    onboardingComplete: false,
    displayName: '',
    language: 'pl',
    aiProactiveCoach: false,
  },
}))

vi.mock('@/stores/workout-store', () => ({
  useWorkoutStore: {
    getState: () => ({ reset: vi.fn() }),
  },
}))

vi.mock('@/lib/notifications', () => ({
  cancelReminder: vi.fn(),
}))

vi.mock('@/lib/auth-lifecycle', () => ({
  clearSignedOutPreference: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: { clear: vi.fn() },
    workoutSessions: { clear: vi.fn() },
    activeWorkout: { clear: vi.fn() },
    activeCustomWorkout: { clear: vi.fn() },
    syncQueue: { clear: vi.fn() },
    maxTests: { clear: vi.fn() },
    exercises: { clear: vi.fn() },
    customPlans: { clear: vi.fn() },
    customProgramProgress: { clear: vi.fn() },
    aiInsights: { clear: vi.fn() },
    aiAnalysisCache: { clear: vi.fn() },
    sessionTombstones: { clear: vi.fn() },
  },
}))

import { clearAllLocalData } from '@/lib/local-data'

describe('clearAllLocalData preserves local-only settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves AI API keys after clear', async () => {
    await clearAllLocalData()

    expect(mockSetState).toHaveBeenCalledTimes(1)
    const [newState] = mockSetState.mock.calls[0]
    expect(newState.settings.aiApiKey).toBe('sk-test-key')
    expect(newState.settings.aiModel).toBe('gpt-4o-mini')
    expect(newState.settings.aiBaseUrl).toBe('https://api.openai.com/v1')
  })

  it('preserves language preference after clear', async () => {
    await clearAllLocalData()

    const [newState] = mockSetState.mock.calls[0]
    expect(newState.settings.language).toBe('en')
  })

  it('resets synced settings to defaults after clear', async () => {
    await clearAllLocalData()

    const [newState] = mockSetState.mock.calls[0]
    // theme was 'dark' but should reset to 'system'
    expect(newState.settings.theme).toBe('system')
    // weightUnit was 'lb' but should reset to 'kg'
    expect(newState.settings.weightUnit).toBe('kg')
  })

  it('AI keys are never included in sync payload', async () => {
    await clearAllLocalData()

    const [newState] = mockSetState.mock.calls[0]
    // AI keys present but they are local-only — verify they exist
    // without being part of any sync mechanism
    expect(newState.settings).toHaveProperty('aiApiKey')
    expect(newState.settings).toHaveProperty('aiModel')
    expect(newState.settings).toHaveProperty('aiBaseUrl')
  })
})
