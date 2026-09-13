import { describe, expect, it } from 'vitest'
import {
  buildForecastSeries,
  computeForecasts,
  linearRegression,
  nextMilestone,
} from '@/lib/forecasting'
import type { LocalWorkoutSession } from '@/lib/db'

const DAY = 86_400_000
// Anchor relative to now — forecasts refuse stale data (>45 dni bez sesji),
// so fixtures must end in the recent past.
const T0 = Date.now() - 60 * DAY

function builtinSession(daysAfter: number, bestReps: number): LocalWorkoutSession {
  return {
    id: `s-${daysAfter}-${bestReps}`,
    program: 'pushups',
    cycleId: 'c1',
    cycleAttempt: 1,
    dayNumber: 1,
    status: 'completed',
    startedAt: new Date(T0 + daysAfter * DAY).toISOString(),
    completedAt: new Date(T0 + daysAfter * DAY).toISOString(),
    setResults: [{ setNumber: 1, target: { kind: 'fixed', reps: bestReps }, actual: bestReps, passed: true }],
  }
}

function customSession(daysAfter: number, exerciseId: string, reps: number, weightKg?: number): LocalWorkoutSession {
  return {
    id: `c-${daysAfter}-${exerciseId}`,
    program: 'custom',
    programKind: 'custom',
    customPlanId: 'plan-1',
    cycleId: 'c1',
    cycleAttempt: 1,
    dayNumber: 1,
    status: 'completed',
    startedAt: new Date(T0 + daysAfter * DAY).toISOString(),
    completedAt: new Date(T0 + daysAfter * DAY).toISOString(),
    setResults: [],
    exerciseLogs: [
      {
        exerciseId,
        order: 1,
        sets: [{ setNumber: 1, actual: { reps, weightKg: weightKg ?? null }, passed: true, prescription: {} }],
      },
    ],
  }
}

describe('linearRegression', () => {
  it('fits a perfect line', () => {
    const { slope, intercept, r2 } = linearRegression([0, 7, 14, 21], [10, 12, 14, 16])
    expect(slope).toBeCloseTo(2 / 7, 5)
    expect(intercept).toBeCloseTo(10, 5)
    expect(r2).toBeCloseTo(1, 5)
  })

  it('returns zero slope for a single point', () => {
    const { slope } = linearRegression([5], [10])
    expect(slope).toBe(0)
  })
})

describe('nextMilestone', () => {
  it('rounds up to next multiple of 5 for reps', () => {
    expect(nextMilestone(23, 'reps')).toBe(25)
    expect(nextMilestone(25, 'reps')).toBe(30)
  })
  it('uses 5kg steps for e1rm and 30s for duration', () => {
    expect(nextMilestone(62.5, 'e1rm')).toBe(65)
    expect(nextMilestone(95, 'duration')).toBe(120)
  })
})

describe('buildForecastSeries', () => {
  it('aggregates builtin sessions to weekly max reps', () => {
    const sessions = [
      builtinSession(0, 20),
      builtinSession(2, 22), // ten sam tydzień — wygrywa max
      builtinSession(7, 25),
      builtinSession(14, 27),
    ]
    const series = buildForecastSeries(sessions, new Map())
    const pushups = series.find((s) => s.key === 'builtin:pushups')
    expect(pushups?.metric).toBe('reps')
    expect(pushups?.points.map((p) => p.v)).toEqual([22, 25, 27])
  })

  it('skips non-completed sessions', () => {
    const s = builtinSession(0, 30)
    s.status = 'in_progress'
    const series = buildForecastSeries([s], new Map())
    expect(series).toHaveLength(0)
  })

  it('picks e1rm for custom exercises with weight, reps for bodyweight', () => {
    const sessions = [
      customSession(0, 'bench', 5, 60),
      customSession(7, 'bench', 5, 62.5),
      customSession(0, 'plank-ex', 0),
    ]
    const map = new Map([['bench', { name: 'Bench' }]])
    const series = buildForecastSeries(sessions, map)
    const bench = series.find((s) => s.key === 'custom:bench')
    expect(bench?.metric).toBe('e1rm')
  })
})

describe('computeForecasts', () => {
  it('predicts a date for a progressing series', () => {
    // 8 tygodni progresu: 20 → 34 (2 powt./tydz.)
    const sessions = Array.from({ length: 8 }, (_, i) => builtinSession(i * 7, 20 + i * 2))
    const forecasts = computeForecasts(sessions, new Map())
    const f = forecasts.find((x) => x.key === 'builtin:pushups')
    expect(f?.status).toBe('ok')
    expect(f?.milestone).toBe(35)
    expect(f?.predictedDate).not.toBeNull()
    expect(f?.confidence).toBe('high')
  })

  it('returns flat status for no-progress series', () => {
    const sessions = Array.from({ length: 6 }, (_, i) => builtinSession(i * 7, 25))
    const f = computeForecasts(sessions, new Map()).find((x) => x.key === 'builtin:pushups')
    expect(f?.status).toBe('flat')
    expect(f?.predictedDate).toBeNull()
  })

  it('returns insufficient for too few points', () => {
    const sessions = [builtinSession(0, 20), builtinSession(7, 22)]
    const f = computeForecasts(sessions, new Map()).find((x) => x.key === 'builtin:pushups')
    expect(f?.status).toBe('insufficient')
  })

  it('returns insufficient for dense but short history', () => {
    // 5 punktów ale w 10 dni — za krótki span
    const sessions = Array.from({ length: 5 }, (_, i) => builtinSession(i * 2, 20 + i))
    const f = computeForecasts(sessions, new Map()).find((x) => x.key === 'builtin:pushups')
    // 5 sesji w ~2 tyg = 2 punkty tygodniowe → insufficient
    expect(f?.status).toBe('insufficient')
  })

  it('returns insufficient for stale history (>45 days since last session)', () => {
    // 8 tygodni progresu, ale ostatnia sesja 100 dni temu
    const sessions = Array.from({ length: 8 }, (_, i) =>
      builtinSession(-100 + i * 7 - 60, 20 + i * 2),
    )
    const f = computeForecasts(sessions, new Map()).find((x) => x.key === 'builtin:pushups')
    expect(f?.status).toBe('insufficient')
    expect(f?.predictedDate).toBeNull()
  })

  it('caps unrealistic horizons as flat', () => {
    // bardzo wolny progres: +1 powt. na 8 tygodni → milestone wymaga lat
    const sessions = Array.from({ length: 10 }, (_, i) => builtinSession(i * 7, 25 + i * 0.1))
    const f = computeForecasts(sessions, new Map()).find((x) => x.key === 'builtin:pushups')
    expect(f?.status === 'flat' || f?.status === 'ok').toBe(true)
    if (f?.status === 'ok') {
      // jeśli ok, data musi być w horyzoncie roku
      const days = (new Date(f.predictedDate!).getTime() - (T0 + 9 * 7 * DAY)) / DAY
      expect(days).toBeLessThanOrEqual(365)
    }
  })
})
