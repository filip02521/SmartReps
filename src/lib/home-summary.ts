import { db, type LocalProgramProgress, type ActiveWorkoutState } from '@/lib/db'
import { getCycleById } from '@/data/plans'
import type { Program, SetTarget } from '@/data/plans/types'
import { getCompletedDaysInCycle } from '@/lib/cycle-progress'
import {
  getTargetReps,
  isWorkoutAvailable,
} from '@/lib/progress-engine'
import { getProgramStats, type ProgramStats } from '@/lib/stats-engine'
import { isStaleActiveWorkout, enqueueSync } from '@/lib/sync'
import { reconcileActiveWorkout } from '@/lib/program-service'
import { pl } from '@/i18n/pl'
import { buildActivityInsights, daysSinceLastPassedSession, type ActivityInsights } from '@/lib/weekly-recap'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { detectPlateau } from '@/lib/ai/proactive-coach'

export type ProgramBucket =
  | 'resume_stale'
  | 'resume'
  | 'test_pending_ready'
  | 'test_pending_rest'
  | 'ready'
  | 'resting'
  | 'paused'
  | 'unconfigured'

export type ResumeInfo = {
  day: number
  set: number
  total: number
  stale: boolean
  currentSetIndex: number
}

export type HomeProgramBar = {
  program: Program
  label: string
  completedDays: number
  totalDays: number
  currentDay: number
  fraction: number
  cycleNameShort: string
  attempt: number
  dayLabel: string
  paused: boolean
  testPending: boolean
}

export type TipKind =
  | 'stale'
  | 'test_ready'
  | 'test_rest'
  | 'level'
  | 'return_after_break'
  | 'habit_almost'
  | 'dual_program'
  | 'login_backup'
  | 'habit_zero'
  | 'habit_met'
  | 'achievement'
  | 'plateau'

export type HomeTipModel = {
  id: string
  kind: TipKind
  message: string
  dismissible: boolean
  /** Optional title override (otherwise HomeTip derives from kind). */
  title?: string
  actionLabel?: string
  actionProgram?: Program
  scrollProgram?: Program
  navigateTo?: string
}

export type PickTipOpts = {
  daysSinceLastPassedSession: number | null
  enabledProgramCount: number
  showLoginBackup?: boolean
  dismissedHabitMetTip?: boolean
  unseenAchievements?: number
  /** When set, a plateau warning tip is shown for this program. */
  plateauProgram?: Program | null
}

export type TipSuppression = {
  stale: boolean
  test: boolean
  level: boolean
}

export type ProgramCardModel = {
  program: Program
  label: string
  accent: string
  bucket: ProgramBucket
  progress: LocalProgramProgress | null
  stats: ProgramStats | null
  resume: ResumeInfo | null
  available: boolean
  daysLeft: number
  cycleNameShort: string | null
  cycleDayCount: number
  currentDaySets: SetTarget[] | null
  setsTargetTotal: number | null
  loadError: string | null
  /** Last completed session failed (for level tip). */
  lastFailed: boolean
}

export type HomeLoadResult = {
  summary: {
    sessions14d: number
    reps14d: number
    streakWeeks: number
    statusHeadline: string
    statusSubtitle?: string
    allResting: boolean
    dateLabel: string
    programs: HomeProgramBar[]
    activity: ActivityInsights
    customLastWorkout: { planName: string; whenLabel: string } | null
  }
  cards: ProgramCardModel[]
  tip: HomeTipModel | null
  tipSuppression: TipSuppression
}

const BUCKET_ORDER: ProgramBucket[] = [
  'resume_stale',
  'resume',
  'test_pending_ready',
  'test_pending_rest',
  'ready',
  'resting',
  'paused',
  'unconfigured',
]

const PROGRAM_ORDER: Program[] = ['pushups', 'pullups']

export function programLabel(program: Program): string {
  return program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
}

export function programAccent(program: Program): string {
  return program === 'pushups' ? 'var(--sr-pushups-accent)' : 'var(--sr-pullups-accent)'
}

export function localDayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatHomeDate(d = new Date()): string {
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

export function deriveProgramBucket(
  progress: LocalProgramProgress | null | undefined,
  resume: ResumeInfo | null,
): ProgramBucket {
  if (!progress) return 'unconfigured'
  const available = isWorkoutAvailable(
    progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const isPaused = progress.status === 'paused'
  const isTestPending = progress.status === 'test_pending'
  const hasResume = !!resume && !isTestPending && !isPaused

  if (hasResume && resume.stale) return 'resume_stale'
  if (hasResume) return 'resume'
  if (isTestPending && available) return 'test_pending_ready'
  if (isTestPending && !available) return 'test_pending_rest'
  if (isPaused) return 'paused'
  if (!available) return 'resting'
  return 'ready'
}

function bucketRank(b: ProgramBucket): number {
  return BUCKET_ORDER.indexOf(b)
}

export function sortPrograms(programs: Program[], buckets: Map<Program, ProgramBucket>): Program[] {
  return [...programs].sort((a, b) => {
    const ra = bucketRank(buckets.get(a) ?? 'unconfigured')
    const rb = bucketRank(buckets.get(b) ?? 'unconfigured')
    if (ra !== rb) return ra - rb
    return PROGRAM_ORDER.indexOf(a) - PROGRAM_ORDER.indexOf(b)
  })
}

function buildResume(
  progress: LocalProgramProgress,
  active: ActiveWorkoutState | undefined,
): ResumeInfo | null {
  if (!active || active.setResults.length === 0) return null
  const cycle = getCycleById(progress.cycleId)
  const day = cycle?.days.find((d) => d.dayNumber === progress.currentDay)
  return {
    day: progress.currentDay,
    set: active.currentSetIndex + 1,
    total: day?.sets.length ?? 5,
    stale: isStaleActiveWorkout(active.updatedAt),
    currentSetIndex: active.currentSetIndex,
  }
}

export function isAllPaused(cards: ProgramCardModel[]): boolean {
  const configured = cards.filter((c) => c.bucket !== 'unconfigured')
  return configured.length > 0 && configured.every((c) => c.bucket === 'paused')
}

export function isAllResting(cards: ProgramCardModel[]): boolean {
  const configured = cards.filter((c) => c.bucket !== 'unconfigured')
  return (
    configured.length > 0 &&
    configured.every((c) => c.bucket === 'resting' || c.bucket === 'paused') &&
    configured.some((c) => c.bucket === 'resting')
  )
}

export type HomeStatusDisplay = {
  headline: string
  subtitle?: string
}

export function buildStatusDisplay(cards: ProgramCardModel[]): HomeStatusDisplay {
  const configured = cards.filter((c) => c.bucket !== 'unconfigured')
  const hasResumeStale = cards.some((c) => c.bucket === 'resume_stale')
  const hasResumeFresh = cards.some((c) => c.bucket === 'resume')
  const hasResume = hasResumeStale || hasResumeFresh
  const otherReady = cards.some((c) => c.bucket === 'ready')
  const testReady = cards.some((c) => c.bucket === 'test_pending_ready')
  const testRest = cards.find((c) => c.bucket === 'test_pending_rest')
  const anyReady = cards.some((c) => c.bucket === 'ready')
  const allResting = isAllResting(cards)
  const allPaused = isAllPaused(cards)
  const allUnconfigured =
    cards.length > 0 && cards.every((c) => c.bucket === 'unconfigured')
  const setupOnly =
    cards.length > 0 &&
    cards.every((c) => c.bucket === 'paused' || c.bucket === 'unconfigured')

  if (hasResume) {
    if (otherReady) return { headline: pl.homeStatusResumeAndReady }
    if (hasResumeStale && !hasResumeFresh) return { headline: pl.homeStatusResumeStale }
    return { headline: pl.homeStatusResume }
  }
  if (testReady) return { headline: pl.homeStatusTestReady }
  if (testRest) {
    const label = testRest.stats?.nextWorkoutLabel ?? pl.today
    return { headline: pl.homeStatusTestRest(label) }
  }
  if (anyReady) return { headline: pl.homeStatusReady }
  if (allResting) {
    const restingCards = configured.filter((c) => c.bucket === 'resting' && c.progress)
    let soonest: ProgramCardModel | null = null
    let soonestTs = Number.POSITIVE_INFINITY
    for (const c of restingCards) {
      const raw = c.progress?.nextWorkoutAfter
      const ts = raw ? new Date(raw).getTime() : 0
      if (ts < soonestTs) {
        soonestTs = ts
        soonest = c
      }
    }
    const next = soonest?.stats?.nextWorkoutLabel ?? pl.today
    return {
      headline: pl.homeStatusRestHeadline,
      subtitle: pl.homeStatusRestSubtitle(next),
    }
  }
  if (allPaused) return { headline: pl.homeStatusAllPaused }
  if (allUnconfigured) return { headline: pl.homeStatusSetup }
  if (setupOnly) return { headline: pl.homeStatusSetupMixed }
  return { headline: pl.homeStatusFallback }
}

export function pickTip(
  cards: ProgramCardModel[],
  sessions14d: number,
  dismissedId: string | null,
  dismissedDay: string | null,
  opts?: PickTipOpts,
): HomeTipModel | null {
  const today = localDayKey()
  const dismissed =
    dismissedDay === today && dismissedId ? new Set([dismissedId]) : new Set<string>()

  const activeTrainable = (c: ProgramCardModel) =>
    c.bucket === 'ready' || c.bucket.startsWith('resume')

  const staleCard = cards.find((c) => c.bucket === 'resume_stale')
  if (staleCard) {
    return {
      id: 'stale',
      kind: 'stale',
      message: pl.staleSession,
      dismissible: false,
      scrollProgram: staleCard.program,
    }
  }

  const testReady = cards.find((c) => c.bucket === 'test_pending_ready')
  if (testReady) {
    return {
      id: 'test_ready',
      kind: 'test_ready',
      message: pl.homeTipTestReady,
      dismissible: false,
      scrollProgram: testReady.program,
    }
  }

  const testRest = cards.find((c) => c.bucket === 'test_pending_rest')
  if (testRest) {
    const next = testRest.stats?.nextWorkoutLabel ?? pl.today
    const otherActive = cards.some(
      (c) => c.program !== testRest.program && activeTrainable(c),
    )
    const other =
      (opts?.enabledProgramCount ?? cards.length) >= 2 && otherActive
        ? pl.homeTipTestRestOther
        : ''
    return {
      id: 'test_rest',
      kind: 'test_rest',
      message: pl.homeTipTestRest(next, other),
      dismissible: false,
      scrollProgram: testRest.program,
    }
  }

  const level = cards.find(
    (c) => c.progress && c.progress.cycleAttempt >= 2 && c.lastFailed,
  )
  if (level) {
    return {
      id: `level-${level.program}`,
      kind: 'level',
      message: pl.considerLowerLevel,
      dismissible: false,
      actionLabel: pl.menuChangeLevel,
      actionProgram: level.program,
      scrollProgram: level.program,
    }
  }

  const daysSince = opts?.daysSinceLastPassedSession ?? null
  if (
    daysSince !== null &&
    daysSince >= 7 &&
    sessions14d >= 1 &&
    !dismissed.has('return-after-break')
  ) {
    const active = cards.find(activeTrainable)
    if (active) {
      return {
        id: 'return-after-break',
        kind: 'return_after_break',
        message: pl.homeTipReturnAfterBreak(daysSince),
        dismissible: true,
        scrollProgram: active.program,
      }
    }
  }

  if (
    (sessions14d === 1 || sessions14d === 2) &&
    !dismissed.has('habit-almost')
  ) {
    const active = cards.find(activeTrainable)
    if (active) {
      return {
        id: 'habit-almost',
        kind: 'habit_almost',
        message: pl.homeTipHabitAlmost(3 - sessions14d),
        dismissible: true,
        scrollProgram: active.program,
      }
    }
  }

  const enabledCount = opts?.enabledProgramCount ?? cards.length
  if (enabledCount >= 2) {
    const unconfigured = cards.find((c) => c.bucket === 'unconfigured')
    // Only nudge the *second* program — not when every enabled card still needs setup
    // (soft onboarding lands dual-unconfigured users on home without forcing Max Test).
    const hasConfigured = cards.some((c) => c.bucket !== 'unconfigured')
    if (unconfigured && hasConfigured) {
      return {
        id: 'dual-program',
        kind: 'dual_program',
        message: pl.homeTipDualProgram,
        dismissible: false,
        scrollProgram: unconfigured.program,
        actionLabel: pl.homeTipDualCta,
        actionProgram: unconfigured.program,
      }
    }
  }

  if (
    opts?.showLoginBackup &&
    daysSince !== null &&
    daysSince >= 3 &&
    !dismissed.has('login-backup')
  ) {
    return {
      id: 'login-backup',
      kind: 'login_backup',
      message: pl.homeTipLoginBackup,
      dismissible: true,
      actionLabel: pl.login,
      navigateTo: '/setup/login',
    }
  }

  // Plateau warning — 3 sessions without progress (higher priority than achievements)
  if (opts?.plateauProgram && !dismissed.has(`plateau-${opts.plateauProgram}`)) {
    const programLabel = opts.plateauProgram === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
    return {
      id: `plateau-${opts.plateauProgram}`,
      kind: 'plateau',
      title: pl.coachPlateauTitle,
      message: pl.coachPlateauTip(programLabel),
      dismissible: true,
      actionLabel: pl.coachPlateauCta,
      navigateTo: '/progress?tab=analysis',
    }
  }

  const unseenAch = opts?.unseenAchievements ?? 0
  if (unseenAch > 0 && !dismissed.has('achievement-unseen')) {
    return {
      id: 'achievement-unseen',
      kind: 'achievement',
      title:
        unseenAch === 1
          ? pl.achievementsHomeTipTitle
          : pl.achievementsHomeTipTitleMany(unseenAch),
      message: pl.achievementsHomeTipBody,
      dismissible: true,
      actionLabel: pl.achievementsHomeTipCta,
      navigateTo: '/progress?tab=achievements',
    }
  }

  if (sessions14d === 0 && !dismissed.has('habit-zero')) {
    const active = cards.find(activeTrainable)
    if (active) {
      const isFirst = daysSince === null
      return {
        id: 'habit-zero',
        kind: 'habit_zero',
        title: isFirst ? pl.homeTipTitleHabitZeroFirst : pl.homeTipTitleHabitZero,
        message: isFirst ? pl.homeTipHabitZeroFirst : pl.homeTipHabitZero,
        dismissible: true,
        scrollProgram: active.program,
      }
    }
  }

  if (
    sessions14d === 3 &&
    !opts?.dismissedHabitMetTip &&
    !dismissed.has('habit-met')
  ) {
    return {
      id: 'habit-met',
      kind: 'habit_met',
      message: pl.homeTipHabitMet,
      dismissible: true,
      actionLabel: pl.ok,
    }
  }

  return null
}

export function tipSuppressionFrom(tip: HomeTipModel | null): TipSuppression {
  return {
    stale: tip?.kind === 'stale',
    test: tip?.kind === 'test_ready' || tip?.kind === 'test_rest',
    level: tip?.kind === 'level',
  }
}

async function loadCustomLastWorkoutInsight(): Promise<{
  planName: string
  whenLabel: string
} | null> {
  const all = await db.workoutSessions.toArray()
  const custom = all
    .filter((s) => isCustomWorkoutSession(s) && s.status === 'completed')
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? b.startedAt).getTime() -
        new Date(a.completedAt ?? a.startedAt).getTime(),
    )
  const last = custom[0]
  if (!last?.customPlanId) return null
  const plan = await db.customPlans.get(last.customPlanId)
  const when = new Date(last.completedAt ?? last.startedAt)
  return {
    planName: plan?.name?.trim() || pl.planDash,
    whenLabel: when.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }),
  }
}

export async function loadHomeDashboard(
  enabledPrograms: Program[],
  opts?: {
    dismissedHomeTipId?: string | null
    dismissedHomeTipDay?: string | null
    showLoginBackup?: boolean
    dismissedHabitMetTip?: boolean
  },
): Promise<HomeLoadResult> {
  const allSessions = await db.workoutSessions.toArray()
  const builtinSessions = allSessions.filter(
    (s) => (s.programKind ?? 'builtin') !== 'custom' && s.program !== 'custom',
  )
  const passedAll = builtinSessions.filter((s) => s.status === 'completed' && s.passed)
  const activity = buildActivityInsights(passedAll)
  const sessions14d = activity.sessions14d
  const reps14d = activity.reps14d
  const daysSince = daysSinceLastPassedSession(passedAll)

  const cardModels = await Promise.all(
    enabledPrograms.map(async (program): Promise<ProgramCardModel> => {
      try {
        const progress =
          (await db.programProgress.where('program').equals(program).first()) ?? null
        if (!progress) {
          return {
            program,
            label: programLabel(program),
            accent: programAccent(program),
            bucket: 'unconfigured',
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
          }
        }

        const active = await reconcileActiveWorkout(program)
        const resume = buildResume(progress, active)
        const stats = await getProgramStats(program, progress)
        const available = isWorkoutAvailable(
          progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
        )
        const daysLeft = (() => {
          if (!progress.nextWorkoutAfter) return 0
          const next = new Date(progress.nextWorkoutAfter)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          next.setHours(0, 0, 0, 0)
          return Math.max(0, Math.ceil((next.getTime() - today.getTime()) / 86400000))
        })()
        const bucket = deriveProgramBucket(progress, resume)
        const cycle = getCycleById(progress.cycleId)
        const day = cycle?.days.find((d) => d.dayNumber === progress.currentDay)
        const sets = day?.sets ?? null
        const setsTargetTotal = sets
          ? sets.reduce((sum, t) => sum + getTargetReps(t), 0)
          : null

        const programSessions = builtinSessions
          .filter((s) => s.program === program && s.status === 'completed')
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        const lastCompleted = programSessions[0]
        const lastFailed = !!lastCompleted && !lastCompleted.passed

        return {
          program,
          label: programLabel(program),
          accent: programAccent(program),
          bucket,
          progress,
          stats,
          resume,
          available,
          daysLeft,
          cycleNameShort: cycle?.nameShort ?? null,
          cycleDayCount: cycle?.days.length ?? 0,
          currentDaySets: sets,
          setsTargetTotal,
          loadError: null,
          lastFailed,
        }
      } catch {
        return {
          program,
          label: programLabel(program),
          accent: programAccent(program),
          bucket: 'unconfigured',
          progress: null,
          stats: null,
          resume: null,
          available: true,
          daysLeft: 0,
          cycleNameShort: null,
          cycleDayCount: 0,
          currentDaySets: null,
          setsTargetTotal: null,
          loadError: pl.errorLoadProgram,
          lastFailed: false,
        }
      }
    }),
  )

  const bucketMap = new Map(cardModels.map((c) => [c.program, c.bucket]))
  const sortedPrograms = sortPrograms(enabledPrograms, bucketMap)
  const cards = sortedPrograms.map((p) => cardModels.find((c) => c.program === p)!)

  const programs: HomeProgramBar[] = []
  for (const c of cards) {
    if (!c.progress || c.bucket === 'unconfigured') continue
    const cycle = getCycleById(c.progress.cycleId)
    if (!cycle) continue
    const completed = getCompletedDaysInCycle(c.progress, cycle)
    const total = cycle.days.length
    const testPending = c.progress.status === 'test_pending'
    programs.push({
      program: c.program,
      label: c.label,
      completedDays: testPending ? total : completed,
      totalDays: total,
      currentDay: testPending ? total : c.progress.currentDay,
      fraction: total > 0 ? (testPending ? 1 : completed / total) : 0,
      cycleNameShort: cycle.nameShort,
      attempt: c.progress.cycleAttempt,
      dayLabel: testPending
        ? pl.cycleDoneTestLabel
        : pl.dayOfTotal(c.progress.currentDay, total),
      paused: c.progress.status === 'paused',
      testPending,
    })
  }

  // Plateau detection — check each enabled program for 3-session stagnation
  let plateauProgram: Program | null = null
  for (const prog of enabledPrograms) {
    const plateau = await detectPlateau(prog, allSessions)
    if (plateau) {
      plateauProgram = prog
      // Persist the plateau insight so it syncs and isn't re-detected for 7 days
      await db.aiInsights.put(plateau)
      void enqueueSync('ai_insights', 'insert', plateau)
      break
    }
  }

  const tip = pickTip(
    cards,
    sessions14d,
    opts?.dismissedHomeTipId ?? null,
    opts?.dismissedHomeTipDay ?? null,
    {
      daysSinceLastPassedSession: daysSince,
      enabledProgramCount: enabledPrograms.length,
      showLoginBackup: opts?.showLoginBackup,
      dismissedHabitMetTip: opts?.dismissedHabitMetTip,
      plateauProgram,
      unseenAchievements: await import('@/lib/achievements/store').then((m) =>
        m.countUnseenUnlocks(),
      ),
    },
  )

  const status = buildStatusDisplay(cards)
  const customLastWorkout = await loadCustomLastWorkoutInsight()

  return {
    summary: {
      sessions14d,
      reps14d,
      streakWeeks: activity.streakWeeks,
      statusHeadline: status.headline,
      statusSubtitle: status.subtitle,
      allResting: isAllResting(cards),
      dateLabel: formatHomeDate(),
      programs,
      activity,
      customLastWorkout,
    },
    cards,
    tip,
    tipSuppression: tipSuppressionFrom(tip),
  }
}
