import { describe, expect, it } from 'vitest'
import { startOfWeek, subWeeks } from 'date-fns'
import { getWeekKey, computeStreakWeeks, startOfLocalWeek } from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import { isAchievementMet, achievementProgress } from '@/lib/achievements/catalog'
import type { AchievementSnapshot } from '@/lib/achievements/types'
import { emptyImpact } from '@/lib/achievements/snapshot'
import type { LocalWorkoutSession } from '@/lib/db'
import { customSessionHasBelowTarget } from '@/lib/custom-session-comparison'

function session(partial: Partial<LocalWorkoutSession> & Pick<LocalWorkoutSession, 'startedAt'>): LocalWorkoutSession {
  return {
    id: partial.id ?? 's1',
    program: 'pushups',
    cycleId: 'pushups-6-10',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    passed: true,
    totalReps: 30,
    setResults: [],
    ...partial,
  }
}

function baseSnap(over: Partial<AchievementSnapshot> = {}): AchievementSnapshot {
  return {
    now: new Date('2026-03-15T12:00:00'),
    completedCount: 0,
    completedInLast14d: 0,
    customCompletedCount: 0,
    customHitTargetCount: 0,
    nightSessionCount: 0,
    dawnSessionCount: 0,
    longSessionCount: 0,
    pushupsSessions: 0,
    pullupsSessions: 0,
    customPlansCount: 0,
    streakWeeks: 0,
    bestStreakWeeks: 0,
    maxPushups: 0,
    maxPullups: 0,
    hasCycleClosedStrong: false,
    cyclesClosedCount: 0,
    workshopCustom: false,
    prRepeatMax: 0,
    comebackStronger: false,
    totalRepsAllTime: 0,
    bodyWeightEntries: 0,
    customExercisesCount: 0,
    aiInsightCount: 0,
    weekendSessionCount: 0,
    impact: emptyImpact(),
    unlockAtHints: {},
    ...over,
  }
}

describe('week key unification', () => {
  it('uses local Monday for week key', () => {
    const wed = new Date('2026-01-14T15:00:00') // Wednesday
    const mon = startOfLocalWeek(wed)
    expect(mon.getDay()).toBe(1)
    expect(getWeekKey(wed)).toBe(getWeekKey(mon))
  })

  it('aligns streak and best-streak week keys', () => {
    const mon1 = startOfWeek(new Date('2026-01-12'), { weekStartsOn: 1 })
    const mon2 = startOfWeek(subWeeks(mon1, 1), { weekStartsOn: 1 })
    const sessions = [
      session({ id: 'a', startedAt: mon1.toISOString() }),
      session({ id: 'b', startedAt: mon2.toISOString() }),
    ]
    expect(computeBestStreakWeeks(sessions)).toBe(2)
    expect(computeStreakWeeks(sessions, mon1)).toBe(2)
  })
})

describe('achievement catalog', () => {
  it('unlocks first_session and habit_3_in_14', () => {
    expect(isAchievementMet('first_session', baseSnap({ completedCount: 1 }))).toBe(true)
    expect(isAchievementMet('habit_3_in_14', baseSnap({ completedInLast14d: 3 }))).toBe(true)
    expect(achievementProgress('habit_3_in_14', baseSnap({ completedInLast14d: 2 }))).toEqual({
      current: 2,
      target: 3,
    })
  })

  it('secret_precision ignores soft-below via hitTarget count only', () => {
    expect(isAchievementMet('secret_precision', baseSnap({ customHitTargetCount: 19 }))).toBe(false)
    expect(isAchievementMet('secret_precision', baseSnap({ customHitTargetCount: 20 }))).toBe(true)
  })

  it('streak mid uses bestStreakWeeks', () => {
    expect(isAchievementMet('streak_4', baseSnap({ streakWeeks: 0, bestStreakWeeks: 4 }))).toBe(true)
    expect(isAchievementMet('streak_1', baseSnap({ streakWeeks: 1 }))).toBe(true)
  })

  it('legend_full_circle requires AND of goals', () => {
    expect(
      isAchievementMet(
        'legend_full_circle',
        baseSnap({
          maxPushups: 100,
          bestStreakWeeks: 12,
          impact: { ...emptyImpact(), trainedTotal: 1 },
        }),
      ),
    ).toBe(true)
    expect(
      isAchievementMet(
        'legend_full_circle',
        baseSnap({ maxPushups: 100, bestStreakWeeks: 12, impact: emptyImpact() }),
      ),
    ).toBe(false)
  })
})

describe('customSessionHasBelowTarget', () => {
  it('detects soft below-target for precision badge input', () => {
    const below = session({
      id: 'c1',
      startedAt: '2026-03-01T10:00:00.000Z',
      program: 'custom',
      programKind: 'custom',
      customPlanId: 'p1',
      exerciseLogs: [
        {
          exerciseId: 'e1',
          order: 0,
          sets: [
            {
              setNumber: 1,
              prescription: { reps: { kind: 'fixed', value: 10 } },
              actual: { reps: 8 },
              passed: false,
            },
          ],
        },
      ],
    })
    expect(customSessionHasBelowTarget(below)).toBe(true)
    const hit = session({
      id: 'c2',
      startedAt: '2026-03-02T10:00:00.000Z',
      program: 'custom',
      programKind: 'custom',
      customPlanId: 'p1',
      exerciseLogs: [
        {
          exerciseId: 'e1',
          order: 0,
          sets: [
            {
              setNumber: 1,
              prescription: { reps: { kind: 'fixed', value: 10 } },
              actual: { reps: 10 },
              passed: true,
            },
          ],
        },
      ],
    })
    expect(customSessionHasBelowTarget(hit)).toBe(false)
  })
})
