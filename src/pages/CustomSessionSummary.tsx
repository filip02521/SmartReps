import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, Trophy, PencilLine, Flame, Dumbbell, CalendarClock, AlertCircle, BarChart3, StickyNote, Award } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState, PageLoader } from '@/components/ux/Feedback'
import { WorkoutCelebrationOverlay } from '@/components/ux/WorkoutCelebrationOverlay'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import { trophyTierFor } from '@/lib/achievements/trophy-tier'
import { LogoMark } from '@/components/brand/Logo'
import {
  CustomProgressionDiffList,
  CustomSessionRecap,
} from '@/components/workout/CustomSessionRecap'
import { NoticeCard, LogIn } from '@/components/ux/NoticeCard'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import type {
  CustomPlan,
  CustomProgramProgress,
  ExerciseDefinition,
} from '@/lib/exercise-model'
import {
  customSessionHasBelowTarget,
  getCustomSessionComparison,
} from '@/lib/custom-session-comparison'
import {
  applySessionLogsToPlanDaySelective,
  buildSessionPlanChanges,
  categorizePlanChanges,
  isPlanUpdateDeclined,
  markPlanUpdateDeclined,
  parseSessionDayPatchJson,
  sessionSuggestsPlanUpdate,
} from '@/lib/custom-plan-session-patch'
import { saveCustomPlan } from '@/lib/custom-plan-service'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { computeCustomSessionInsights, type CustomSessionInsights } from '@/lib/session-summary-insights'
import { sessionTotalSets } from '@/lib/custom-session-stats'
import { daysUntilWorkout } from '@/lib/progress-engine'
import { shouldShowLoginCloudPrompt } from '@/lib/summary-actions'
import { shareCustomSessionCard } from '@/lib/share-card'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { enqueueSync } from '@/lib/sync'
import { track } from '@/lib/analytics'
import { trackShareCard } from '@/lib/analytics'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { releaseBodyScrollLock } from '@/hooks/useFocusTrap'
import { useAchievementUiStore } from '@/stores/achievement-ui-store'
import { AchievementSummaryList } from '@/components/achievements/AchievementSummaryList'
import { WorkoutResultCard } from '@/components/workout/WorkoutResultCard'
import { detectPersonalRecords, type PersonalRecord } from '@/lib/pr-detector'
import { initCelebrationAudio } from '@/lib/celebration-feedback'
import { SessionNoteCard } from '@/components/workout/SessionNoteCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { generatePostWorkoutInsight } from '@/lib/ai/proactive-coach'
import {
  checkRateLimit,
  acquireInflight,
  releaseInflight,
  recordCall,
} from '@/lib/ai/rate-limiter'
import type { LocalAiInsight } from '@/lib/db'

export default function CustomSessionSummary() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sessionId = searchParams.get('session')
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const setHasSeenLoginCloudPrompt = useAppStore((s) => s.setHasSeenLoginCloudPrompt)
  const weightUnit = useAppStore((s) => s.settings.weightUnit)
  const loginPromptTrackedRef = useRef(false)
  /** Ref to track the current session ID for stale-closure-safe checks in async AI calls. */
  const currentSessionIdRef = useRef<string | undefined>(undefined)
  /** AbortController for in-flight AI insight generation — aborted on unmount. */
  const coachAbortRef = useRef<AbortController | null>(null)

  // Abort any in-flight AI request on unmount
  useEffect(() => {
    const ref = coachAbortRef
    return () => {
      ref.current?.abort()
    }
  }, [])

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<LocalWorkoutSession | null>(null)
  const [previous, setPrevious] = useState<LocalWorkoutSession | undefined>()
  const [plan, setPlan] = useState<CustomPlan | null>(null)
  const [planName, setPlanName] = useState<string | null>(null)
  const [progress, setProgress] = useState<CustomProgramProgress | null>(null)
  const [exerciseMap, setExerciseMap] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [insights, setInsights] = useState<CustomSessionInsights | undefined>()
  const [coachInsight, setCoachInsight] = useState<LocalAiInsight | null>(null)
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [sharing, setSharing] = useState(false)
  const [offerPlanUpdate, setOfferPlanUpdate] = useState(false)
  const [planUpdateBusy, setPlanUpdateBusy] = useState(false)
  const [planUpdateDone, setPlanUpdateDone] = useState(false)
  const [applyValues, setApplyValues] = useState(true)
  const [applyExercises, setApplyExercises] = useState(false)
  const [newAchievements, setNewAchievements] = useState<
    import('@/lib/achievements/types').LocalAchievementUnlock[]
  >([])
  const [prRecords, setPrRecords] = useState<PersonalRecord[]>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const achievementQueue = useAchievementUiStore((s) => s.queue)
  const clearQueue = useAchievementUiStore((s) => s.clearQueue)
  const setSummaryMode = useAchievementUiStore((s) => s.setSummaryMode)

  // Summary page owns the achievement queue — suppress AchievementHost popups
  useEffect(() => {
    setSummaryMode(true)
    return () => setSummaryMode(false)
  }, [setSummaryMode])

  // Initialize audio context on mount so celebration sound works on iOS PWA
  useEffect(() => {
    void initCelebrationAudio()
  }, [])

  // Subscribe to queue changes — handles race condition where evaluation
  // completes after summary mount. Drain queue into local state when items arrive.
  useEffect(() => {
    if (achievementQueue.length === 0) return
    setNewAchievements((prev) => {
      const existingIds = new Set(prev.map((r) => r.id))
      const fresh = achievementQueue.filter((r) => !existingIds.has(r.id))
      return fresh.length > 0 ? [...prev, ...fresh] : prev
    })
    clearQueue()
  }, [achievementQueue, clearQueue])

  useEffect(() => {
    releaseBodyScrollLock()
  }, [sessionId])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setEmail(null)
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null)
    })
  }, [])

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setLoading(false)
      return
    }
    void (async () => {
      setLoading(true)
      setInsights(undefined)
      setPrevious(undefined)
      setShowCelebration(false)
      try {
        const s = await db.workoutSessions.get(sessionId)
        if (!s) {
          setSession(null)
          setInsights(undefined)
          return
        }
        setSession(s)
        currentSessionIdRef.current = s.id
        // Detect personal records for celebration banner
        let records: PersonalRecord[] = []
        try {
          records = await detectPersonalRecords(s)
          setPrRecords(records)
        } catch {
          setPrRecords([])
        }
        // Trigger celebration overlay on successful completion:
        // - Always for first 3 workouts (onboarding honeymoon)
        // - After that: only when PR or new achievement makes it special
        if (s.passed !== false) {
          const totalCompleted = await db.workoutSessions
            .filter((row) => row.status === 'completed')
            .count()
          const isSpecial = records.length > 0 || achievementQueue.length > 0
          const isEarlyWorkout = totalCompleted <= 3
          setShowCelebration(isSpecial || isEarlyWorkout)
        }
        const resolvedPlanId = s.customPlanId ?? planId
        if (resolvedPlanId) {
          const [plan, prog, exercises, comparison, historicalSessions] = await Promise.all([
            db.customPlans.get(resolvedPlanId),
            db.customProgramProgress.where('customPlanId').equals(resolvedPlanId).first(),
            db.exercises.toArray(),
            getCustomSessionComparison(resolvedPlanId, sessionId),
            db.workoutSessions
              .filter(
                (row) =>
                  isCustomWorkoutSession(row) &&
                  row.status === 'completed',
              )
              .toArray(),
          ])
          setPlanName(plan?.name ?? null)
          setPlan(plan ?? null)
          setProgress(prog ?? null)
          setPrevious(comparison.previous)
          const map = new Map<string, ExerciseDefinition>()
          for (const ex of exercises) map.set(ex.id, ex)
          setExerciseMap(map)
          const sessionDay = parseSessionDayPatchJson(s.sessionDayPatchJson)
          const suggests =
            !!plan &&
            !isPlanUpdateDeclined(s.id) &&
            sessionSuggestsPlanUpdate(plan, s.dayNumber, s.exerciseLogs ?? [], sessionDay, map)
          setOfferPlanUpdate(suggests)
          setPlanUpdateDone(false)
          setInsights(
            computeCustomSessionInsights({
              current: s,
              previous: comparison.previous,
              exerciseMap: map,
              historicalSessions,
            }),
          )
          // Detect personal records for celebration banner
          try {
            const records = await detectPersonalRecords(s)
            setPrRecords(records)
          } catch {
            setPrRecords([])
          }
          // Proactive coach: load or generate post-workout insight
          void loadOrGenerateCoachInsight(s, comparison.previous, historicalSessions, exercises)
        } else {
          setPlan(null)
          setOfferPlanUpdate(false)
          setInsights(undefined)
          setPrRecords([])
        }
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when session/plan identity changes; achievementQueue is read at call time
  }, [sessionId, planId])

  async function loadOrGenerateCoachInsight(
    current: LocalWorkoutSession,
    previousSession: LocalWorkoutSession | undefined,
    historicalSessions: LocalWorkoutSession[],
    exercises: ExerciseDefinition[],
  ) {
    const existing = await db.aiInsights.where('sessionId').equals(current.id).first()
    // Only cache AI insights — local insights are cheap to regenerate and
    // depend on `previous` which can change as more sessions are completed.
    if (existing && !existing.dismissedAt && existing.source === 'ai') {
      setCoachInsight(existing)
      return
    }
    if (existing?.dismissedAt) return

    const settings = useAppStore.getState().settings
    const aiConfig = settings.aiProactiveCoach && settings.aiApiKey
      ? { apiKey: settings.aiApiKey, model: settings.aiModel ?? 'gpt-4o-mini', baseURL: settings.aiBaseUrl || undefined, reasoningEffort: settings.aiReasoningEffort }
      : undefined

    // Rate limit check — only for AI calls
    let usedInflight = false
    if (aiConfig) {
      const rl = checkRateLimit('post_workout')
      if (!rl.allowed) {
        // Silently use local fallback for auto-fire
        try {
          if (coachAbortRef.current?.signal.aborted) return
          const controller = new AbortController()
          coachAbortRef.current = controller
          const insight = await generatePostWorkoutInsight({
            session: current,
            previous: previousSession,
            historicalSessions,
            exercises,
            aiConfig: undefined, // force local
            signal: controller.signal,
          })
          if (current.id !== currentSessionIdRef.current) return
          if (coachAbortRef.current?.signal.aborted) return
          await db.aiInsights.put(insight)
          void enqueueSync('ai_insights', 'insert', insight)
          setCoachInsight(insight)
        } catch {
          // Non-blocking
        }
        return
      }
      acquireInflight('post_workout')
      usedInflight = true
    }

    try {
      // Guard against unmount — don't start AI call if component is gone
      if (coachAbortRef.current?.signal.aborted) return
      // Create abort controller for this AI call — aborted on component unmount
      const controller = new AbortController()
      coachAbortRef.current = controller
      const insight = await generatePostWorkoutInsight({
        session: current,
        previous: previousSession,
        historicalSessions,
        exercises,
        aiConfig,
        signal: controller.signal,
      })
      // Guard against stale state if user navigated away during async generation
      if (current.id !== currentSessionIdRef.current) return
      if (coachAbortRef.current?.signal.aborted) return
      if (insight.source === 'ai') recordCall('post_workout')
      await db.aiInsights.put(insight)
      void enqueueSync('ai_insights', 'insert', insight)
      setCoachInsight(insight)
    } catch {
      // Non-blocking
    } finally {
      if (usedInflight) releaseInflight('post_workout')
    }
  }

  const sessionPassed = session?.passed !== false
  const showLoginPrompt =
    !loading &&
    session &&
    email !== undefined &&
    shouldShowLoginCloudPrompt({
      passed: sessionPassed,
      email,
      hasSeenLoginCloudPrompt,
    })

  useEffect(() => {
    if (!showLoginPrompt || loginPromptTrackedRef.current) return
    loginPromptTrackedRef.current = true
    track('login_cloud_prompt_shown')
  }, [showLoginPrompt])

  async function handleSavePlanFromSession(opts?: { values?: boolean; exercises?: boolean }) {
    if (!session || !plan || planUpdateBusy) return
    const values = opts?.values ?? applyValues
    const exercises = opts?.exercises ?? applyExercises
    if (!values && !exercises) return
    setPlanUpdateBusy(true)
    try {
      const sessionDay = parseSessionDayPatchJson(session.sessionDayPatchJson)
      const next = applySessionLogsToPlanDaySelective(
        plan,
        session.dayNumber,
        session.exerciseLogs ?? [],
        exerciseMap,
        sessionDay,
        { applyValues: values, applyExercises: exercises },
      )
      const saved = await saveCustomPlan(next, { skipValidation: true })
      setPlan(saved)
      const cleared: LocalWorkoutSession = {
        ...session,
        sessionDayPatchJson: null,
      }
      await db.workoutSessions.put(cleared)
      await enqueueSync('workout_sessions', 'update', cleared)
      setSession(cleared)
      setOfferPlanUpdate(false)
      setPlanUpdateDone(true)
      showToast(pl.customSummaryUpdatePlanDone, 'success')
      track('custom_plan_updated_from_session')
    } catch {
      showToast(pl.customSummaryUpdatePlanFailed, 'error')
    } finally {
      setPlanUpdateBusy(false)
    }
  }

  async function handleDiscardPlanUpdate() {
    if (!session) {
      setOfferPlanUpdate(false)
      return
    }
    markPlanUpdateDeclined(session.id)
    const cleared: LocalWorkoutSession = {
      ...session,
      sessionDayPatchJson: null,
    }
    try {
      await db.workoutSessions.put(cleared)
      await enqueueSync('workout_sessions', 'update', cleared)
      setSession(cleared)
    } catch {
      /* local only — decline flag still hides the card */
    }
    setOfferPlanUpdate(false)
    track('custom_plan_update_discarded')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.loading} />
      </div>
    )
  }

  if (
    !session ||
    session.status !== 'completed' ||
    (planId && session.customPlanId && session.customPlanId !== planId)
  ) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <EmptyState
          icon={<LogoMark size={48} />}
          title={pl.sessionSummaryMissingTitle}
          description={pl.missingSessionHint}
          action={{
            label: pl.myPlansTitle,
            onClick: () => navigate('/plans?tab=mine'),
          }}
        />
        <Button variant="ghost" className="mt-3" fullWidth onClick={() => navigate('/')}>
          {pl.backHome}
        </Button>
      </div>
    )
  }

  const resolvedPlanId = session.customPlanId ?? planId
  const failed = session.passed === false
  const belowTarget = customSessionHasBelowTarget(session)
  const totalSets = sessionTotalSets(session)
  const exerciseCount = session.exerciseLogs?.length ?? 0
  // Compute share-card enrichment metrics from session logs
  const allLogs = session.exerciseLogs ?? []
  const allSetLogs = allLogs.flatMap((l) => l.sets ?? [])
  const bestSetReps = allSetLogs.length > 0
    ? Math.max(...allSetLogs.map((s) => s.actual.reps ?? 0))
    : undefined
  const volumeKg = allSetLogs.reduce((sum, s) => {
    const reps = s.actual.reps ?? 0
    const kg = s.actual.weightKg ?? 0
    return sum + (kg > 0 ? reps * kg : 0)
  }, 0)
  const cycleComplete =
    !failed &&
    (progress?.status === 'cycle_complete' || !!session.progressionDiffJson)
  const daysLeft = daysUntilWorkout(
    progress?.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const dismissLoginPrompt = () => setHasSeenLoginCloudPrompt(true)
  const sessionDayPatch = parseSessionDayPatchJson(session.sessionDayPatchJson)
  const planChanges =
    plan != null
      ? buildSessionPlanChanges(
          plan,
          session.dayNumber,
          session.exerciseLogs ?? [],
          sessionDayPatch,
          exerciseMap,
        )
      : []
  const planChangeHasSets = planChanges.some((c) => c.kind === 'sets' || c.kind === 'target_values')
  const { hasValueChanges, hasExerciseChanges } = categorizePlanChanges(planChanges)
  const canSaveSelected = applyValues || applyExercises

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      {/* Workout celebration overlay — full-screen reward on completion */}
      <WorkoutCelebrationOverlay
        active={showCelebration}
        onDismiss={() => setShowCelebration(false)}
        onShare={async () => {
          try {
            await shareCustomSessionCard({
              planName: planName ?? pl.dayLabel(session.dayNumber),
              dayNumber: session.dayNumber,
              exerciseCount,
              totalSets,
              passed: session.passed !== false,
              bestSetReps,
              volumeKg: volumeKg > 0 ? Math.round(volumeKg) : undefined,
            })
            trackShareCard('custom', true)
            showToast(pl.summaryShareDone, 'success')
          } catch {
            showToast(pl.summaryShareFailed, 'error')
          }
        }}
        contextLabel={
          plan
            ? pl.celebrationDayContext(session.dayNumber, plan.days.length)
            : undefined
        }
        hasPr={prRecords.length > 0}
        hasNewAchievement={newAchievements.length > 0}
        achievementTrophyTier={
          newAchievements.length > 0
            ? (() => {
                const u = newAchievements[0]!
                const def = ACHIEVEMENT_BY_ID[u.id]
                if (!def) return null
                return trophyTierFor(def, true, u.tierLevel)
              })()
            : null
        }
        stats={[
          { icon: Dumbbell, value: totalSets, label: pl.celebrationStatSets, animate: true },
          ...(volumeKg > 0
            ? [{ icon: Flame, value: Math.round(volumeKg), label: pl.celebrationStatVolume, animate: true }]
            : [{ icon: Flame, value: exerciseCount, label: pl.celebrationStatExercises, animate: true }]),
        ]}
      />

      <PageHeader
        title={failed ? pl.customDayFailed : pl.customDayPassed}
        subtitle={
          planName
            ? pl.progressCustomSessionMeta(planName, session.dayNumber)
            : pl.dayLabel(session.dayNumber)
        }
      />

      {/* Hero status banner */}
      {/* Unified workout result card — status + PR + AI + CTA in one cohesive unit */}
      <WorkoutResultCard
        className="mb-6"
        failed={failed}
        title={failed ? pl.summaryHeroFail : pl.summaryHeroSuccess}
        subtitle={`${planName ?? pl.dayLabel(session.dayNumber)} · ${pl.attemptShort(session.cycleAttempt)}`}
        prRecords={prRecords}
        coachInsight={coachInsight}
        onDismissInsight={async () => {
          if (!coachInsight) return
          const dismissed = { ...coachInsight, dismissedAt: new Date().toISOString() }
          await db.aiInsights.put(dismissed)
          void enqueueSync('ai_insights', 'update', dismissed)
          setCoachInsight(null)
          showToast(pl.coachPostWorkoutDismissed, 'info')
        }}
        primaryLabel={failed && resolvedPlanId ? pl.customFailRetryDay : resolvedPlanId ? pl.customSummaryBackToPlan : pl.backHome}
        onPrimaryAction={() => {
          if (failed && resolvedPlanId) navigate(`/workout/custom/${resolvedPlanId}`)
          else if (resolvedPlanId) navigate(`/plans?tab=mine`)
          else navigate('/')
        }}
        shareLabel={pl.summaryShare}
        shareDisabled={sharing}
        onShare={async () => {
          setSharing(true)
          try {
            await shareCustomSessionCard({
              planName: planName ?? pl.dayLabel(session.dayNumber),
              dayNumber: session.dayNumber,
              exerciseCount,
              totalSets,
              passed: session.passed !== false,
              bestSetReps,
              volumeKg: volumeKg > 0 ? Math.round(volumeKg) : undefined,
            })
            trackShareCard('custom', true)
            showToast(pl.summaryShareDone, 'success')
          } catch {
            showToast(pl.summaryShareFailed, 'error')
          } finally {
            setSharing(false)
          }
        }}
      />

      {/* Achievements — celebration moment, keep near result card */}
      {newAchievements.length > 0 && (
        <div className="mb-6">
          <SectionHeader icon={Award} title={pl.summarySectionAchievements} />
          <AchievementSummaryList unlocks={newAchievements} />
        </div>
      )}

      {/* Cycle complete — prominent celebration card */}
      {cycleComplete && (
        <Card className="mb-6 border border-[var(--sr-brand-primary)]/40 bg-[var(--sr-brand-primary-muted)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary)]/15 text-[var(--sr-brand-primary)]" aria-hidden>
              <Trophy size={20} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--sr-text-primary)]">{pl.cycleComplete}</p>
              <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.customCycleCompleteHint}</p>
            </div>
          </div>
          {resolvedPlanId && progress?.status === 'cycle_complete' && (
            <div className="mt-4">
              <Button size="touch" fullWidth onClick={() => navigate(`/workout/custom/${resolvedPlanId}`)}>
                {pl.customCycleCompleteCta}
              </Button>
            </div>
          )}
        </Card>
      )}

      {!failed && progress?.nextWorkoutAfter && progress.status === 'rest' && (
        <div className="mb-6 flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-4">
          <CalendarClock size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.nextWorkoutIn(daysLeft)}
          </p>
        </div>
      )}

      {belowTarget && (
        <div className="mb-6 flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/30 bg-[var(--sr-warning-muted)] p-4">
          <AlertCircle size={18} className="shrink-0 text-[var(--sr-warning)]" aria-hidden />
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.customSummaryBelowTarget}
          </p>
        </div>
      )}

      {offerPlanUpdate && planChanges.length > 0 && (
        <Card className="mb-6 border border-[var(--sr-border-subtle)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]" aria-hidden>
              <PencilLine size={20} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--sr-text-primary)]">
                {pl.customSummaryUpdatePlanTitle}
              </p>
              <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.customSummaryUpdatePlanBody}
              </p>
            </div>
          </div>
          {planChanges.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 sr-text-body-sm text-[var(--sr-text-primary)]">
              {planChanges.map((change, idx) => {
                if (change.kind === 'exercise_swap') {
                  const fromName = exerciseMap.get(change.fromExerciseId)?.name ?? change.fromExerciseId
                  const toName = exerciseMap.get(change.toExerciseId)?.name ?? change.toExerciseId
                  return (
                    <li key={`swap-${change.fromExerciseId}-${change.toExerciseId}-${idx}`}>
                      {pl.customSummaryUpdatePlanSwap(fromName, toName)}
                    </li>
                  )
                }
                if (change.kind === 'exercise_added') {
                  const name = exerciseMap.get(change.exerciseId)?.name ?? change.exerciseId
                  return (
                    <li key={`added-${change.exerciseId}-${idx}`}>
                      {pl.customSummaryUpdatePlanAdded(name)}
                    </li>
                  )
                }
                if (change.kind === 'target_values') {
                  const name = exerciseMap.get(change.exerciseId)?.name ?? change.exerciseId
                  const summary = change.changes.map((c) => {
                    const segments: string[] = []
                    if (c.fromReps != null && c.toReps != null) {
                      segments.push(pl.customSummaryValueReps(c.fromReps, c.toReps))
                    }
                    if (c.fromWeightKg != null && c.toWeightKg != null) {
                      segments.push(pl.customSummaryValueWeight(c.fromWeightKg, c.toWeightKg))
                    }
                    if (c.fromDurationSec != null && c.toDurationSec != null) {
                      segments.push(pl.customSummaryValueDuration(c.fromDurationSec, c.toDurationSec))
                    }
                    return pl.customSummaryValueSet(c.setNumber, segments.join(', '))
                  }).join(' · ')
                  return (
                    <li key={`target-${change.exerciseId}-${idx}`}>
                      {pl.customSummaryUpdatePlanValues(name, summary)}
                    </li>
                  )
                }
                const name = exerciseMap.get(change.exerciseId)?.name ?? change.exerciseId
                const key = `${change.kind}-${change.exerciseId}-${change.from}-${change.to}-${idx}`
                return (
                  <li key={key}>
                    {change.kind === 'sets'
                      ? pl.customSummaryUpdatePlanSets(name, change.from, change.to)
                      : pl.customSummaryUpdatePlanRest(name, change.from, change.to)}
                  </li>
                )
              })}
            </ul>
          )}

          {/* Selective update checkboxes */}
          <div className="mt-4 flex flex-col gap-3">
            {hasValueChanges && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyValues}
                  onChange={(e) => setApplyValues(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)] text-[var(--sr-brand-primary)] focus:ring-[var(--sr-brand-primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--sr-text-primary)]">
                    {pl.customSummaryUpdatePlanGroupValues}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">
                    {pl.customSummaryUpdatePlanGroupValuesHint}
                  </span>
                </span>
              </label>
            )}
            {hasExerciseChanges && (
              <label className="flex min-h-11 cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyExercises}
                  onChange={(e) => setApplyExercises(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-[var(--sr-border-strong)] bg-[var(--sr-bg-surface)] text-[var(--sr-brand-primary)] focus:ring-[var(--sr-brand-primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-[var(--sr-text-primary)]">
                    {pl.customSummaryUpdatePlanGroupExercises}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--sr-text-muted)]">
                    {pl.customSummaryUpdatePlanGroupExercisesHint}
                  </span>
                </span>
              </label>
            )}
          </div>

          {planChangeHasSets && applyValues && (
            <p className="mt-2 sr-text-caption text-[var(--sr-text-muted)]">
              {pl.customSummaryUpdatePlanTargetsNote}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2">
            {hasValueChanges && hasExerciseChanges && (
              <Button
                size="touch"
                fullWidth
                disabled={planUpdateBusy || !canSaveSelected}
                onClick={() => void handleSavePlanFromSession()}
              >
                {pl.customSummaryUpdatePlanSaveSelected}
              </Button>
            )}
            <Button
              size="touch"
              fullWidth
              variant={hasValueChanges && hasExerciseChanges ? 'secondary' : 'primary'}
              disabled={planUpdateBusy}
              onClick={() => void handleSavePlanFromSession({ values: true, exercises: true })}
            >
              {pl.customSummaryUpdatePlanSaveAll}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={planUpdateBusy}
              onClick={() => void handleDiscardPlanUpdate()}
            >
              {pl.customSummaryUpdatePlanDiscard}
            </Button>
          </div>
        </Card>
      )}

      {planUpdateDone && (
        <div className="mb-6 flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)] p-4">
          <CheckCircle2 size={18} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
          <p className="sr-text-body-sm text-[var(--sr-text-primary)]">
            {pl.customSummaryUpdatePlanDone}
          </p>
        </div>
      )}

      {session.progressionDiffJson && resolvedPlanId && (
        <CustomProgressionDiffList
          diffJson={session.progressionDiffJson}
          planId={resolvedPlanId}
        />
      )}

      <div className="mt-6">
        <SectionHeader icon={BarChart3} title={pl.summarySectionStats} />
        <CustomSessionRecap
          current={session}
          previous={previous}
          exerciseMap={exerciseMap}
          insights={insights}
          weightUnit={weightUnit}
        />
      </div>

      {session?.id && (
        <div className="mt-6">
          <SectionHeader icon={StickyNote} title={pl.summarySectionNotes} />
          <SessionNoteCard sessionId={session.id} />
        </div>
      )}

      {showLoginPrompt && (
        <NoticeCard
          className="mt-6"
          tone="brand"
          icon={<LogIn size={20} strokeWidth={2.25} />}
          title={pl.standaloneLoginCoachTitle}
          message={pl.summaryLoginBackup}
          actionLabel={pl.standaloneLoginCoachCta}
          onAction={() => {
            dismissLoginPrompt()
            track('login_cloud_prompt_clicked')
            if (resolvedPlanId && planName) {
              useAppStore.getState().setPendingCustomStart({
                customPlanId: resolvedPlanId,
                planName,
                navigateToWorkout: session?.passed !== false,
              })
            }
            navigate('/setup/login', {
              state: {
                returnTo: `/workout/custom/${resolvedPlanId}/summary?session=${sessionId}`,
              },
            })
          }}
          dismissLabel={pl.standaloneLoginCoachDismiss}
          onDismiss={dismissLoginPrompt}
          stackActions
        />
      )}

      {/* Secondary actions — at the bottom (primary CTA is in result card) */}
      <div className="mt-8 flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] pt-6">
        {resolvedPlanId && (
          <Button variant="ghost" fullWidth onClick={() => navigate('/')}>
            {pl.backHome}
          </Button>
        )}
        <Button variant="ghost" fullWidth onClick={() => navigate('/progress?tab=custom&view=history')}>
          {pl.customSummaryViewProgress}
        </Button>
      </div>
    </div>
  )
}
