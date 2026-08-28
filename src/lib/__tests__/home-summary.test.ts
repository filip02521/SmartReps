import { describe, expect, it } from 'vitest'
import {
  buildStatusSentence,
  deriveProgramBucket,
  localDayKey,
  pickTip,
  sortPrograms,
  tipSuppressionFrom,
  type ProgramCardModel,
  type ResumeInfo,
} from '@/lib/home-summary'
import type { LocalProgramProgress } from '@/lib/db'
import { pl } from '@/i18n/pl'

function prog(partial: Partial<LocalProgramProgress>): LocalProgramProgress {
  return {
    id: 1,
    program: 'pushups',
    cycleId: 'pushups-6-10',
    currentDay: 1,
    cycleAttempt: 1,
    status: 'active',
    nextWorkoutAfter: null,
    lastWorkoutAt: null,
    updatedAt: new Date().toISOString(),
    ...partial,
  }
}

const resumeFresh: ResumeInfo = {
  day: 1,
  set: 2,
  total: 5,
  stale: false,
  currentSetIndex: 1,
}

const resumeStale: ResumeInfo = { ...resumeFresh, stale: true }

function card(partial: Partial<ProgramCardModel> & Pick<ProgramCardModel, 'program' | 'bucket'>): ProgramCardModel {
  return {
    label: partial.program === 'pullups' ? pl.pullupsProgram : pl.pushupsProgram,
    accent: 'x',
    progress: null,
    stats: null,
    resume: null,
    available: true,
    daysLeft: 0,
    cycleNameShort: null,
    cycleDayCount: 0,
    currentDaySets: null,
    setsTargetTotal: null,
    loadError: null,
    lastFailed: false,
    ...partial,
  }
}

describe('deriveProgramBucket', () => {
  it('unconfigured when no progress', () => {
    expect(deriveProgramBucket(null, null)).toBe('unconfigured')
  })

  it('resume_stale / resume take priority', () => {
    expect(deriveProgramBucket(prog({}), resumeStale)).toBe('resume_stale')
    expect(deriveProgramBucket(prog({}), resumeFresh)).toBe('resume')
  })

  it('test_pending ready vs rest', () => {
    expect(
      deriveProgramBucket(prog({ status: 'test_pending', nextWorkoutAfter: null }), null),
    ).toBe('test_pending_ready')
    const future = new Date()
    future.setDate(future.getDate() + 2)
    expect(
      deriveProgramBucket(
        prog({ status: 'test_pending', nextWorkoutAfter: future.toISOString() }),
        null,
      ),
    ).toBe('test_pending_rest')
  })

  it('cycle_failed mid-rest maps to resting', () => {
    const future = new Date()
    future.setDate(future.getDate() + 2)
    expect(
      deriveProgramBucket(
        prog({ status: 'cycle_failed', nextWorkoutAfter: future.toISOString() }),
        null,
      ),
    ).toBe('resting')
  })

  it('paused ignores resume-like active for bucket when paused', () => {
    expect(deriveProgramBucket(prog({ status: 'paused' }), resumeFresh)).toBe('paused')
  })

  it('sortPrograms orders by bucket then pushups', () => {
    const sorted = sortPrograms(
      ['pullups', 'pushups'],
      new Map([
        ['pullups', 'ready'],
        ['pushups', 'resting'],
      ]),
    )
    expect(sorted).toEqual(['pullups', 'pushups'])
  })
})

describe('buildStatusSentence', () => {
  it('soft copy when resume and other ready', () => {
    const sentence = buildStatusSentence([
      card({
        program: 'pushups',
        bucket: 'resume',
        resume: resumeFresh,
        progress: prog({}),
      }),
      card({ program: 'pullups', bucket: 'ready', progress: prog({ program: 'pullups' }) }),
    ])
    expect(sentence).toBe(pl.homeStatusResumeAndReady)
  })

  it('picks soonest nextWorkoutAfter when all resting', () => {
    const later = new Date()
    later.setDate(later.getDate() + 5)
    const sooner = new Date()
    sooner.setDate(sooner.getDate() + 1)
    const sentence = buildStatusSentence([
      card({
        program: 'pushups',
        bucket: 'resting',
        progress: prog({ nextWorkoutAfter: later.toISOString() }),
        stats: {
          lastSession: undefined,
          nextWorkoutLabel: 'za 5 dni',
          lastTotalReps: null,
          maxLastSetTrend: { current: 0, previous: null, delta: null },
          passedSessionCount: 0,
          totalRepsAllTime: 0,
          streakWeeks: 0,
          maxTestRecord: null,
          completedDaysInCycle: 0,
          cycleDaysTotal: 12,
        },
      }),
      card({
        program: 'pullups',
        bucket: 'resting',
        progress: prog({ program: 'pullups', nextWorkoutAfter: sooner.toISOString() }),
        stats: {
          lastSession: undefined,
          nextWorkoutLabel: 'jutro',
          lastTotalReps: null,
          maxLastSetTrend: { current: 0, previous: null, delta: null },
          passedSessionCount: 0,
          totalRepsAllTime: 0,
          streakWeeks: 0,
          maxTestRecord: null,
          completedDaysInCycle: 0,
          cycleDaysTotal: 9,
        },
      }),
    ])
    expect(sentence).toBe(pl.homeStatusAllRest('jutro'))
  })
})

describe('pickTip + tipSuppressionFrom', () => {
  it('stale wins and suppresses stale banner', () => {
    const tip = pickTip(
      [
        card({
          program: 'pushups',
          bucket: 'resume_stale',
          resume: resumeStale,
          progress: prog({}),
        }),
      ],
      0,
      null,
      null,
    )
    expect(tip?.kind).toBe('stale')
    expect(tipSuppressionFrom(tip).stale).toBe(true)
  })

  it('habit-zero dismissed for the day is skipped', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      'habit-zero',
      localDayKey(),
    )
    // If dismissed habit-zero, may fall through to habit-met (sessions 0) or null/rest
    expect(tip?.id === 'habit-zero').toBe(false)
  })

  it('no tip when sessions 1–2 and ready if habit-almost dismissed', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      2,
      'habit-almost',
      localDayKey(),
    )
    expect(tip).toBeNull()
  })

  it('habit_almost tip for sessions 1–2', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      2,
      null,
      null,
    )
    expect(tip?.kind).toBe('habit_almost')
  })

  it('return_after_break after 7+ days', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      1,
      null,
      null,
      { daysSinceLastPassedSession: 8, enabledProgramCount: 1 },
    )
    expect(tip?.kind).toBe('return_after_break')
  })

  it('dual_program when one ready and one unconfigured', () => {
    const tip = pickTip(
      [
        card({ program: 'pushups', bucket: 'ready', progress: prog({}) }),
        card({ program: 'pullups', bucket: 'unconfigured' }),
      ],
      3,
      null,
      null,
      { daysSinceLastPassedSession: 1, enabledProgramCount: 2 },
    )
    expect(tip?.kind).toBe('dual_program')
  })

  it('login_backup when flagged and 3+ days since last session', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      3,
      null,
      null,
      { daysSinceLastPassedSession: 4, enabledProgramCount: 1, showLoginBackup: true },
    )
    expect(tip?.kind).toBe('login_backup')
    expect(tip?.navigateTo).toBe('/setup/login')
  })

  it('level tip requires lastFailed', () => {
    const withoutFail = pickTip(
      [
        card({
          program: 'pushups',
          bucket: 'ready',
          progress: prog({ cycleAttempt: 2 }),
          lastFailed: false,
        }),
      ],
      1,
      null,
      null,
    )
    expect(withoutFail?.kind === 'level').toBe(false)

    const withFail = pickTip(
      [
        card({
          program: 'pushups',
          bucket: 'ready',
          progress: prog({ cycleAttempt: 2 }),
          lastFailed: true,
        }),
      ],
      1,
      null,
      null,
    )
    expect(withFail?.kind).toBe('level')
    expect(tipSuppressionFrom(withFail).level).toBe(true)
  })

  it('rest_all tip sets allRest suppression', () => {
    const future = new Date()
    future.setDate(future.getDate() + 2)
    const tip = pickTip(
      [
        card({
          program: 'pushups',
          bucket: 'resting',
          progress: prog({ nextWorkoutAfter: future.toISOString() }),
        }),
      ],
      0,
      'habit-zero',
      localDayKey(),
      { daysSinceLastPassedSession: 1, enabledProgramCount: 1 },
    )
    expect(tip?.kind).toBe('rest_all')
    expect(tipSuppressionFrom(tip).allRest).toBe(true)
  })
})
