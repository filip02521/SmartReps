import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import { builtinSession } from './test-fixtures'

const sessions: LocalWorkoutSession[] = []
const exercises: ExerciseDefinition[] = []

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      toArray: async () => sessions,
    },
    exercises: {
      get: async (id: string) => exercises.find((e) => e.id === id),
    },
  },
}))

vi.mock('@/lib/custom-session-utils', () => ({
  isCustomWorkoutSession: (s: LocalWorkoutSession) => s.program === 'custom',
}))

import { detectPersonalRecords } from '@/lib/pr-detector'

function customSession(
  id: string,
  startedAt: string,
  exerciseLogs: Array<{ exerciseId: string; sets: Array<{ actual: { reps?: number; weightKg?: number; durationSec?: number } }> }>,
): LocalWorkoutSession {
  return {
    id,
    program: 'custom',
    programKind: 'custom',
    customPlanId: 'plan1',
    cycleId: 'c1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt,
    completedAt: startedAt,
    passed: true,
    exerciseLogs: exerciseLogs as LocalWorkoutSession['exerciseLogs'],
    setResults: [],
  }
}

beforeEach(() => {
  sessions.length = 0
  exercises.length = 0
})

describe('detectPersonalRecords — builtin', () => {
  it('detects new best session total', async () => {
    sessions.push(builtinSession('s1', '2026-01-01T10:00:00.000Z', 20, [10, 10]))
    const current = builtinSession('s2', '2026-01-02T10:00:00.000Z', 25, [12, 13])
    const records = await detectPersonalRecords(current)
    expect(records).toHaveLength(2)
    const sessionRecord = records.find((r) => r.kind === 'bestSession')
    expect(sessionRecord).toBeDefined()
    expect(sessionRecord!.value).toBe(25)
    expect(sessionRecord!.previousValue).toBe(20)
  })

  it('detects new best max set', async () => {
    sessions.push(builtinSession('s1', '2026-01-01T10:00:00.000Z', 20, [10, 10]))
    const current = builtinSession('s2', '2026-01-02T10:00:00.000Z', 25, [15, 10])
    const records = await detectPersonalRecords(current)
    const maxSetRecord = records.find((r) => r.kind === 'bestMaxSet')
    expect(maxSetRecord).toBeDefined()
    expect(maxSetRecord!.value).toBe(15)
    expect(maxSetRecord!.previousValue).toBe(10)
  })

  it('returns empty when no PR broken', async () => {
    sessions.push(builtinSession('s1', '2026-01-01T10:00:00.000Z', 30, [15, 15]))
    const current = builtinSession('s2', '2026-01-02T10:00:00.000Z', 20, [10, 10])
    const records = await detectPersonalRecords(current)
    expect(records).toHaveLength(0)
  })

  it('sets previousValue to null for first-ever record', async () => {
    const current = builtinSession('s1', '2026-01-01T10:00:00.000Z', 20, [10, 10])
    const records = await detectPersonalRecords(current)
    expect(records).toHaveLength(2)
    expect(records.every((r) => r.previousValue === null)).toBe(true)
  })

  it('ignores incomplete sessions', async () => {
    const incomplete = builtinSession('s1', '2026-01-01T10:00:00.000Z', 20, [10])
    incomplete.status = 'in_progress'
    sessions.push(incomplete)
    const current = builtinSession('s2', '2026-01-02T10:00:00.000Z', 25, [15])
    const records = await detectPersonalRecords(current)
    // First-ever since incomplete doesn't count
    expect(records.every((r) => r.previousValue === null)).toBe(true)
  })
})

describe('detectPersonalRecords — custom', () => {
  it('detects maxReps PR for custom exercise', async () => {
    exercises.push({
      id: 'ex1',
      name: 'Pompki',
      primaryMetric: 'reps',
      archived: false,
    } as ExerciseDefinition)
    sessions.push(
      customSession('s1', '2026-01-01T10:00:00.000Z', [
        { exerciseId: 'ex1', sets: [{ actual: { reps: 10 } }, { actual: { reps: 10 } }] },
      ]),
    )
    const current = customSession('s2', '2026-01-02T10:00:00.000Z', [
      { exerciseId: 'ex1', sets: [{ actual: { reps: 15 } }, { actual: { reps: 12 } }] },
    ])
    const records = await detectPersonalRecords(current)
    const repsRecord = records.find((r) => r.kind === 'maxReps')
    expect(repsRecord).toBeDefined()
    expect(repsRecord!.value).toBe(15)
    expect(repsRecord!.previousValue).toBe(10)
    expect(repsRecord!.exerciseName).toBe('Pompki')
  })

  it('detects maxWeight PR for custom exercise', async () => {
    exercises.push({
      id: 'ex2',
      name: 'Wyciskanie',
      primaryMetric: 'reps_weight',
      archived: false,
    } as ExerciseDefinition)
    sessions.push(
      customSession('s1', '2026-01-01T10:00:00.000Z', [
        { exerciseId: 'ex2', sets: [{ actual: { reps: 10, weightKg: 50 } }] },
      ]),
    )
    const current = customSession('s2', '2026-01-02T10:00:00.000Z', [
      { exerciseId: 'ex2', sets: [{ actual: { reps: 10, weightKg: 60 } }] },
    ])
    const records = await detectPersonalRecords(current)
    const weightRecord = records.find((r) => r.kind === 'maxWeight')
    expect(weightRecord).toBeDefined()
    expect(weightRecord!.value).toBe(60)
    expect(weightRecord!.previousValue).toBe(50)
  })

  it('detects maxDuration PR for time-based exercise', async () => {
    exercises.push({
      id: 'ex3',
      name: 'Plank',
      primaryMetric: 'duration_sec',
      archived: false,
    } as ExerciseDefinition)
    sessions.push(
      customSession('s1', '2026-01-01T10:00:00.000Z', [
        { exerciseId: 'ex3', sets: [{ actual: { durationSec: 30 } }] },
      ]),
    )
    const current = customSession('s2', '2026-01-02T10:00:00.000Z', [
      { exerciseId: 'ex3', sets: [{ actual: { durationSec: 45 } }] },
    ])
    const records = await detectPersonalRecords(current)
    const durRecord = records.find((r) => r.kind === 'maxDuration')
    expect(durRecord).toBeDefined()
    expect(durRecord!.value).toBe(45)
    expect(durRecord!.previousValue).toBe(30)
  })
})
