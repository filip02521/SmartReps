import { describe, expect, it, beforeEach, vi } from 'vitest'

const mockGetState = vi.fn()
const mockSetState = vi.fn()

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => mockGetState(),
    setState: (...args: unknown[]) => mockSetState(...args),
  },
}))

// Mock notifications to prevent EnvironmentTeardownError from dynamic import
// racing with test environment teardown.
vi.mock('@/lib/notifications', () => ({
  scheduleDailyReminder: vi.fn(),
  cancelReminder: vi.fn(),
  requestWorkoutReminderPermission: vi.fn(),
  showWorkoutReminder: vi.fn(),
}))

import {
  mergeEnabledProgramsFromProfile,
  mergeEnabledProgramsFromProgress,
  mergeEnabledCustomWorkoutsFromProfile,
  mergeUiSettingsFromProfile,
  parseEnabledPrograms,
} from '@/lib/enabled-programs-sync'

describe('parseEnabledPrograms', () => {
  it('filters invalid programs and defaults to pushups', () => {
    expect(parseEnabledPrograms(['pushups', 'pullups', 'invalid'])).toEqual(['pushups', 'pullups'])
    expect(parseEnabledPrograms([])).toEqual(['pushups'])
    expect(parseEnabledPrograms(null)).toEqual(['pushups'])
  })
})

describe('mergeEnabledCustomWorkoutsFromProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      settings: {
        enabledCustomPlanIds: ['a'],
        customPlansFilterExplicit: false,
      },
      enabledCustomWorkoutsUpdatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('applies newer remote custom plan ids', () => {
    const changed = mergeEnabledCustomWorkoutsFromProfile({
      enabled_programs: null,
      enabled_programs_updated_at: null,
      enabled_workouts_json: ['a', 'b'],
      enabled_workouts_updated_at: '2026-06-01T00:00:00.000Z',
      custom_plans_filter_explicit: true,
    })
    expect(changed).toBe(true)
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          enabledCustomPlanIds: ['a', 'b'],
          customPlansFilterExplicit: true,
        }),
      }),
    )
  })
})

describe('mergeEnabledProgramsFromProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      settings: { enabledPrograms: ['pushups'] },
      enabledProgramsUpdatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('applies remote when newer than local', () => {
    const changed = mergeEnabledProgramsFromProfile({
      enabled_programs: ['pushups', 'pullups'],
      enabled_programs_updated_at: '2026-06-01T00:00:00.000Z',
    })
    expect(changed).toBe(true)
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ enabledPrograms: ['pushups', 'pullups'] }),
        enabledProgramsUpdatedAt: '2026-06-01T00:00:00.000Z',
      }),
    )
  })

  it('ignores remote when older than local', () => {
    const changed = mergeEnabledProgramsFromProfile({
      enabled_programs: ['pullups'],
      enabled_programs_updated_at: '2025-01-01T00:00:00.000Z',
    })
    expect(changed).toBe(false)
    expect(mockSetState).not.toHaveBeenCalled()
  })
})

describe('mergeEnabledProgramsFromProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      settings: { enabledPrograms: ['pushups'] },
    })
  })

  it('adds programs with remote progress as legacy fallback', () => {
    mergeEnabledProgramsFromProgress(['pullups'])
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ enabledPrograms: ['pushups', 'pullups'] }),
      }),
    )
  })
})

describe('mergeUiSettingsFromProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      settings: {
        theme: 'system',
        timerSound: true,
        timerVibration: true,
        keepScreenOn: true,
        reminderHour: 18,
        enabledPrograms: ['pushups'],
        aiProactiveCoach: false,
      },
      uiSettingsUpdatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('applies newer remote theme prefs', () => {
    const changed = mergeUiSettingsFromProfile({
      enabled_programs: null,
      enabled_programs_updated_at: null,
      theme_preference: 'light',
      timer_sound: false,
      timer_vibration: true,
      keep_screen_on: false,
      reminder_hour: 7,
      ui_settings_updated_at: '2026-06-01T00:00:00.000Z',
    })
    expect(changed).toBe(true)
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          theme: 'light',
          timerSound: false,
          keepScreenOn: false,
          reminderHour: 7,
        }),
        uiSettingsUpdatedAt: '2026-06-01T00:00:00.000Z',
      }),
    )
  })
})
