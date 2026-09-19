import { describe, expect, it } from 'vitest'
import {
  buildStatusDisplay,
  deriveProgramBucket,
  localDayKey,
  pickTip,
  resolveNextAction,
  sortPrograms,
  tipSuppressionFrom,
  type ProgramCardModel,
  type ResumeInfo,
} from '@/lib/home-summary'
import type { CustomPlanHomeCardModel } from '@/lib/custom-plan-home-summary'
import type { LocalProgramProgress, LocalWorkoutSession } from '@/lib/db'
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
    label:
      partial.program === 'pullups'
        ? pl.pullupsProgram
        : partial.program === 'squats'
          ? pl.squatsProgram
          : pl.pushupsProgram,
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

describe('buildStatusDisplay', () => {
  it('contextual headline when resume and other ready', () => {
    const status = buildStatusDisplay([
      card({
        program: 'pushups',
        bucket: 'resume',
        resume: resumeFresh,
        progress: prog({}),
      }),
      card({ program: 'pullups', bucket: 'ready', progress: prog({ program: 'pullups' }) }),
    ])
    expect(status.headline).toBe(pl.homeStatusResumeHeadline(pl.pushupsProgram))
    expect(status.subtitle).toBe(pl.homeStatusResumeAndReadySubtitle(pl.pullupsProgram))
  })

  it('picks soonest nextWorkoutAfter when all resting', () => {
    const later = new Date()
    later.setDate(later.getDate() + 5)
    const sooner = new Date()
    sooner.setDate(sooner.getDate() + 1)
    const status = buildStatusDisplay([
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
    expect(status.headline).toBe(pl.homeStatusRestHeadline)
    expect(status.subtitle).toBe(pl.homeStatusRestSubtitle('jutro'))
  })

  it('shows paused headline when all programs paused', () => {
    const status = buildStatusDisplay([
      card({ program: 'pushups', bucket: 'paused', progress: prog({ status: 'paused' }) }),
      card({
        program: 'pullups',
        bucket: 'paused',
        progress: prog({ program: 'pullups', status: 'paused' }),
      }),
    ])
    expect(status.headline).toBe(pl.homeStatusAllPaused)
  })

  it('contextual headline with day/total when ready', () => {
    const status = buildStatusDisplay([
      card({
        program: 'pushups',
        bucket: 'ready',
        progress: prog({ currentDay: 5 }),
        cycleDayCount: 21,
      }),
    ])
    expect(status.headline).toBe(pl.homeStatusReadyHeadline(5, 21))
    expect(status.subtitle).toBe(pl.homeStatusReadySubtitle(pl.pushupsProgram))
  })

  it('resume headline when stale resume only', () => {
    const status = buildStatusDisplay([
      card({
        program: 'pushups',
        bucket: 'resume_stale',
        resume: resumeStale,
        progress: prog({}),
      }),
    ])
    expect(status.headline).toBe(pl.homeStatusResumeHeadline(pl.pushupsProgram))
    expect(status.subtitle).toBe(pl.homeStatusResumeStaleSubtitle)
  })

  it('setup headline names the program when a single card is unconfigured', () => {
    const status = buildStatusDisplay([
      card({ program: 'pushups', bucket: 'unconfigured' }),
    ])
    expect(status.headline).toBe(pl.setupNextProgram(pl.pushupsProgram))
    expect(status.subtitle).toBe(pl.homeStatusSetupSubtitle)
  })

  it('setup headline stays generic when multiple cards are unconfigured', () => {
    const status = buildStatusDisplay([
      card({ program: 'pushups', bucket: 'unconfigured' }),
      card({ program: 'pullups', bucket: 'unconfigured' }),
    ])
    expect(status.headline).toBe(pl.homeStatusSetupHeadline)
    expect(status.subtitle).toBe(pl.homeStatusSetupSubtitle)
  })
})

function session(partial: Partial<LocalWorkoutSession>): LocalWorkoutSession {
  return {
    id: 's1',
    program: 'pushups',
    cycleId: 'pushups-6-10',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    setResults: [],
    ...partial,
  }
}

function customModel(
  partial: Partial<CustomPlanHomeCardModel>,
): CustomPlanHomeCardModel {
  return {
    planId: 'plan-1',
    planName: 'Mój plan',
    badge: { label: 'x', variant: 'default' },
    dayLine: 'Dzień 1/3',
    previewLine: '',
    detailLine: null,
    resume: null,
    ctaLabel: 'x',
    ctaAction: 'train',
    totalDays: 3,
    completedDays: 0,
    pct: 0,
    cycleDays: null,
    isPaused: false,
    isCycleComplete: false,
    isResting: false,
    restDaysLeft: 0,
    cycleAttempt: 1,
    ...partial,
  }
}

describe('resolveNextAction', () => {
  it('ready builtin → builtin hero', () => {
    const next = resolveNextAction(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      [],
      [],
    )
    expect(next.kind).toBe('builtin')
    if (next.kind === 'builtin') expect(next.card.program).toBe('pushups')
  })

  it('unconfigured builtin → builtin hero (setup)', () => {
    const next = resolveNextAction(
      [card({ program: 'pushups', bucket: 'unconfigured' })],
      [],
      [],
    )
    expect(next.kind).toBe('builtin')
    if (next.kind === 'builtin') expect(next.card.bucket).toBe('unconfigured')
  })

  it('ready wins over resting card', () => {
    const future = new Date()
    future.setDate(future.getDate() + 2)
    const next = resolveNextAction(
      [
        card({
          program: 'pushups',
          bucket: 'resting',
          progress: prog({ nextWorkoutAfter: future.toISOString() }),
        }),
        card({
          program: 'pullups',
          bucket: 'ready',
          progress: prog({ program: 'pullups' }),
        }),
      ],
      [],
      [],
    )
    expect(next.kind).toBe('builtin')
    if (next.kind === 'builtin') expect(next.card.program).toBe('pullups')
  })

  it('all resting → rest hero with the soonest return', () => {
    const later = new Date()
    later.setDate(later.getDate() + 5)
    const sooner = new Date()
    sooner.setDate(sooner.getDate() + 1)
    const next = resolveNextAction(
      [
        card({
          program: 'pushups',
          bucket: 'resting',
          progress: prog({ nextWorkoutAfter: later.toISOString() }),
        }),
        card({
          program: 'pullups',
          bucket: 'resting',
          progress: prog({
            program: 'pullups',
            nextWorkoutAfter: sooner.toISOString(),
          }),
        }),
      ],
      [],
      [],
    )
    expect(next.kind).toBe('rest')
    if (next.kind === 'rest') expect(next.card.program).toBe('pullups')
  })

  it('in-progress builtin session wins over a ready card', () => {
    const resumeCard = card({
      program: 'pushups',
      bucket: 'resume',
      resume: resumeFresh,
      progress: prog({}),
    })
    const next = resolveNextAction(
      [
        resumeCard,
        card({
          program: 'pullups',
          bucket: 'ready',
          progress: prog({ program: 'pullups' }),
        }),
      ],
      [],
      [session({ program: 'pushups' })],
    )
    expect(next.kind).toBe('builtin')
    if (next.kind === 'builtin') expect(next.card.program).toBe('pushups')
  })

  it('freshest in-progress session wins across sources', () => {
    const older = new Date(Date.now() - 3600_000).toISOString()
    const next = resolveNextAction(
      [
        card({
          program: 'pushups',
          bucket: 'resume',
          resume: resumeFresh,
          progress: prog({}),
        }),
      ],
      [
        customModel({
          planId: 'plan-1',
          resume: { day: 1, set: 2, totalSets: 5, stale: false },
        }),
      ],
      [
        // Builtin session is older — the custom session wins.
        session({ id: 's-old', program: 'pushups', startedAt: older }),
        session({
          id: 's-new',
          program: 'custom',
          programKind: 'custom',
          customPlanId: 'plan-1',
        }),
      ],
    )
    expect(next.kind).toBe('custom')
    if (next.kind === 'custom') expect(next.model.planId).toBe('plan-1')
  })

  it('free session hero when the live session is ad-hoc', () => {
    const next = resolveNextAction(
      [
        card({
          program: 'pushups',
          bucket: 'ready',
          progress: prog({}),
        }),
      ],
      [],
      [
        session({
          id: 's-free',
          program: 'custom',
          programKind: 'custom',
          customPlanId: undefined,
          cycleId: 'free',
        }),
      ],
    )
    expect(next.kind).toBe('free')
  })

  it('trainable custom plan hero when no builtin day is due', () => {
    const future = new Date()
    future.setDate(future.getDate() + 2)
    const next = resolveNextAction(
      [
        card({
          program: 'pushups',
          bucket: 'resting',
          progress: prog({ nextWorkoutAfter: future.toISOString() }),
        }),
      ],
      [customModel({ planId: 'plan-1', ctaAction: 'train' })],
      [],
    )
    expect(next.kind).toBe('custom')
    if (next.kind === 'custom') expect(next.model.planId).toBe('plan-1')
  })

  it('paused custom plan does not become the hero', () => {
    const next = resolveNextAction(
      [],
      [customModel({ planId: 'plan-1', isPaused: true, ctaAction: 'unpause' })],
      [],
    )
    expect(next.kind).toBe('free')
  })

  it('nothing configured → free hero', () => {
    expect(resolveNextAction([], [], []).kind).toBe('free')
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

  it('welcome card shows for new users (hasCompletedFirstWorkout=false)', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      null,
      null,
      { daysSinceLastPassedSession: null, enabledProgramCount: 1, hasCompletedFirstWorkout: false },
    )
    expect(tip?.kind).toBe('welcome')
    expect(tip?.dismissible).toBe(true)
    expect(tip?.actionLabel).toBe(pl.homeTipWelcomeCta)
  })

  it('welcome card hidden when hasCompletedFirstWorkout=true', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      null,
      null,
      { daysSinceLastPassedSession: null, enabledProgramCount: 1, hasCompletedFirstWorkout: true },
    )
    expect(tip?.kind).not.toBe('welcome')
  })

  it('welcome card hidden when welcomeCardDismissed=true', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      null,
      null,
      { daysSinceLastPassedSession: null, enabledProgramCount: 1, hasCompletedFirstWorkout: false, welcomeCardDismissed: true },
    )
    expect(tip?.kind).not.toBe('welcome')
  })

  it('welcome card hidden when dismissed for the day', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      'welcome',
      localDayKey(),
      { daysSinceLastPassedSession: null, enabledProgramCount: 1, hasCompletedFirstWorkout: false },
    )
    expect(tip?.kind).not.toBe('welcome')
  })

  it('stale wins over welcome card', () => {
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
      { daysSinceLastPassedSession: null, enabledProgramCount: 1, hasCompletedFirstWorkout: false },
    )
    expect(tip?.kind).toBe('stale')
  })

  it('welcome card does not show when hasCompletedFirstWorkout is undefined', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      null,
      null,
      { daysSinceLastPassedSession: null, enabledProgramCount: 1 },
    )
    expect(tip?.kind).not.toBe('welcome')
  })

  it('welcome card hidden for restored users (hasAnyCompletedSession=true)', () => {
    // After clearAllLocalData + cloud restore, hasCompletedFirstWorkout resets
    // to false but sessions exist — a returning user must not see the welcome card.
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      null,
      null,
      {
        daysSinceLastPassedSession: null,
        enabledProgramCount: 1,
        hasCompletedFirstWorkout: false,
        hasAnyCompletedSession: true,
      },
    )
    expect(tip?.kind).not.toBe('welcome')
  })

  it('habit-zero dismissed for the day is skipped', () => {
    const tip = pickTip(
      [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })],
      0,
      'habit-zero',
      localDayKey(),
    )
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
    expect(tip?.message).toBe(pl.homeTipHabitAlmost(1))
  })

  it('habit_almost / habit_zero / return skip when only resting', () => {
    const resting = [
      card({
        program: 'pushups',
        bucket: 'resting',
        progress: prog({}),
      }),
    ]
    expect(
      pickTip(resting, 2, null, null, {
        daysSinceLastPassedSession: 2,
        enabledProgramCount: 1,
      }),
    ).toBeNull()
    expect(
      pickTip(resting, 0, null, null, {
        daysSinceLastPassedSession: 20,
        enabledProgramCount: 1,
      }),
    ).toBeNull()
    expect(
      pickTip(resting, 1, null, null, {
        daysSinceLastPassedSession: 8,
        enabledProgramCount: 1,
      }),
    ).toBeNull()
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

  it('dual_program when second program unconfigured', () => {
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
    expect(tip?.dismissible).toBe(false)
    expect(tip?.actionProgram).toBe('pullups')
  })

  it('dual_program does not fire when all enabled programs are unconfigured', () => {
    const tip = pickTip(
      [
        card({ program: 'pushups', bucket: 'unconfigured' }),
        card({ program: 'pullups', bucket: 'unconfigured' }),
      ],
      0,
      null,
      null,
      { daysSinceLastPassedSession: null, enabledProgramCount: 2 },
    )
    expect(tip?.kind).not.toBe('dual_program')
  })

  it('dual_program does not fire when other program is only resting', () => {
    const tip = pickTip(
      [
        card({ program: 'pushups', bucket: 'ready', progress: prog({}) }),
        card({ program: 'pullups', bucket: 'resting', progress: prog({}) }),
      ],
      2,
      null,
      null,
      { daysSinceLastPassedSession: 1, enabledProgramCount: 2 },
    )
    expect(tip?.kind).toBe('habit_almost')
  })

  it('habit_met only at exactly 3 sessions and respects sticky dismiss', () => {
    const ready = [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })]
    expect(pickTip(ready, 3, null, null)?.kind).toBe('habit_met')
    expect(pickTip(ready, 4, null, null)).toBeNull()
    expect(
      pickTip(ready, 3, null, null, {
        daysSinceLastPassedSession: 1,
        enabledProgramCount: 1,
        dismissedHabitMetTip: true,
      }),
    ).toBeNull()
  })

  it('habit_zero first vs return copy', () => {
    const ready = [card({ program: 'pushups', bucket: 'ready', progress: prog({}) })]
    const first = pickTip(ready, 0, null, null, {
      daysSinceLastPassedSession: null,
      enabledProgramCount: 1,
    })
    expect(first?.kind).toBe('habit_zero')
    expect(first?.title).toBe(pl.homeTipTitleHabitZeroFirst)
    expect(first?.message).toBe(pl.homeTipHabitZeroFirst)

    const returning = pickTip(ready, 0, null, null, {
      daysSinceLastPassedSession: 20,
      enabledProgramCount: 1,
    })
    expect(returning?.kind).toBe('habit_zero')
    expect(returning?.title).toBe(pl.homeTipTitleHabitZero)
    expect(returning?.message).toBe(pl.homeTipHabitZero)
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

  it('does not show a tip when all programs are resting and nothing else applies', () => {
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
      null,
      null,
      { daysSinceLastPassedSession: 1, enabledProgramCount: 1 },
    )
    expect(tip).toBeNull()
  })

  it('tipSuppressionFrom only flags matching tip kinds', () => {
    expect(tipSuppressionFrom(null)).toEqual({ stale: false, test: false, level: false })
    expect(
      tipSuppressionFrom({
        id: 'test_ready',
        kind: 'test_ready',
        message: 'x',
        dismissible: false,
      }),
    ).toEqual({ stale: false, test: true, level: false })
  })
})
