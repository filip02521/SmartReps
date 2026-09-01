import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExerciseDefinition } from '@/lib/exercise-model'

const enqueueSyncMock = vi.fn()
const enqueueActiveMock = vi.fn()

const mockDb = vi.hoisted(() => ({
  exercises: { toArray: vi.fn(), put: vi.fn(), get: vi.fn() },
  customPlans: { toArray: vi.fn(), put: vi.fn() },
  workoutSessions: { toArray: vi.fn(), put: vi.fn() },
  activeCustomWorkout: { toArray: vi.fn(), put: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/sync', () => ({
  enqueueSync: (...args: unknown[]) => enqueueSyncMock(...args),
  enqueueActiveCustomWorkoutSync: (...args: unknown[]) => enqueueActiveMock(...args),
}))

function exercise(
  partial: Partial<ExerciseDefinition> & Pick<ExerciseDefinition, 'id' | 'name'>,
): ExerciseDefinition {
  return {
    primaryMetric: 'reps',
    restDefaultSec: 90,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('mergeDuplicateExercises', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('archives duplicate and remaps plan references to canonical id', async () => {
    const canonical = exercise({ id: 'keep', name: 'Pompki', createdAt: '2025-01-01T00:00:00.000Z' })
    const duplicate = exercise({ id: 'drop', name: ' pompki ', createdAt: '2026-01-01T00:00:00.000Z' })
    mockDb.exercises.toArray.mockResolvedValue([canonical, duplicate])
    mockDb.customPlans.toArray.mockResolvedValue([
      {
        id: 'plan-1',
        name: 'Plan',
        description: '',
        status: 'active',
        source: 'user',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
        days: [
          {
            dayNumber: 1,
            restAfterDay: 1,
            exercises: [{ exerciseId: 'drop', order: 0, sets: [], restBetweenSetsSec: 90 }],
          },
        ],
      },
    ])
    mockDb.workoutSessions.toArray.mockResolvedValue([
      {
        id: 'session-1',
        program: 'custom',
        cycleId: 'c1',
        dayNumber: 1,
        cycleAttempt: 1,
        status: 'completed',
        startedAt: '2026-01-01',
        setResults: [],
        exerciseLogs: [{ exerciseId: 'keep', order: 0, sets: [] }],
      },
    ])
    mockDb.activeCustomWorkout.toArray.mockResolvedValue([])

    const { mergeDuplicateExercises } = await import('@/lib/custom-exercise-dedup')
    const result = await mergeDuplicateExercises()

    expect(result.mergedGroups).toBe(1)
    expect(mockDb.customPlans.put).toHaveBeenCalledWith(
      expect.objectContaining({
        days: [
          expect.objectContaining({
            exercises: [expect.objectContaining({ exerciseId: 'keep' })],
          }),
        ],
      }),
    )
    expect(mockDb.exercises.put).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'drop', archived: true }),
    )
    expect(enqueueSyncMock).toHaveBeenCalledWith('custom_plans', 'update', expect.any(Object))
    expect(enqueueSyncMock).toHaveBeenCalledWith(
      'user_exercises',
      'update',
      expect.objectContaining({ id: 'drop', archived: true }),
    )
  })
})
