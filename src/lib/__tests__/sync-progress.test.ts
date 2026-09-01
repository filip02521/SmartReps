import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const supabaseCallOrder: string[] = []

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => ({
      enabledProgramsUpdatedAt: '2026-01-01T00:00:00.000Z',
      enabledCustomWorkoutsUpdatedAt: '2026-01-01T00:00:00.000Z',
      uiSettingsUpdatedAt: '2026-01-01T00:00:00.000Z',
      settings: {
        enabledPrograms: ['pushups'],
        enabledCustomPlanIds: [],
        customPlansFilterExplicit: false,
        theme: 'system',
        timerSound: false,
        timerVibration: false,
        keepScreenOn: true,
        reminderHour: 18,
      },
    }),
    setState: vi.fn(),
  },
}))

vi.mock('@/lib/enabled-programs-sync', () => ({
  mergeEnabledProgramsFromProfile: vi.fn(),
  mergeEnabledCustomWorkoutsFromProfile: vi.fn(),
  mergeEnabledProgramsFromProgress: vi.fn(),
  mergeUiSettingsFromProfile: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: {
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          first: vi.fn().mockResolvedValue(undefined),
        })),
      })),
      toArray: vi.fn().mockResolvedValue([]),
      add: vi.fn(),
      update: vi.fn(),
    },
    workoutSessions: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn() },
    maxTests: {
      toArray: vi.fn().mockResolvedValue([]),
      where: vi.fn(() => ({
        equals: vi.fn(() => ({
          filter: vi.fn(() => ({ first: vi.fn().mockResolvedValue(undefined) })),
        })),
      })),
      add: vi.fn(),
    },
    activeWorkout: { toArray: vi.fn().mockResolvedValue([]), get: vi.fn(), put: vi.fn() },
    syncQueue: {
      orderBy: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
      toArray: vi.fn().mockResolvedValue([]),
    },
  },
}))

function makeQueryBuilder(table: string, rows: unknown[] = []) {
  const builder = {
    select: vi.fn(() => {
      supabaseCallOrder.push(`select:${table}`)
      return builder
    }),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    order: vi.fn().mockResolvedValue({ data: rows, error: null }),
    upsert: vi.fn(async () => {
      supabaseCallOrder.push(`upsert:${table}`)
      return { error: null }
    }),
    delete: vi.fn(() => builder),
    in: vi.fn().mockResolvedValue({ error: null }),
  }
  return builder
}

describe('syncWithRemote ordering', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    supabaseCallOrder.length = 0
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockFrom.mockImplementation((table: string) => makeQueryBuilder(table))
  })

  it('reads program_progress from remote before pushing profile/progress', async () => {
    const { syncWithRemote } = await import('@/lib/sync')
    await syncWithRemote()

    const pullProgressSelect = supabaseCallOrder.indexOf('select:program_progress')
    const firstPushUpsert = supabaseCallOrder.findIndex((entry) => entry.startsWith('upsert:'))
    expect(pullProgressSelect).toBeGreaterThanOrEqual(0)
    expect(firstPushUpsert).toBeGreaterThan(pullProgressSelect)
  })
})
