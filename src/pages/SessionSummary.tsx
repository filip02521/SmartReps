import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Trophy, AlertTriangle, Flame, Dumbbell, BarChart3, StickyNote, Award, TrendingUp } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { getProgramLabel } from '@/lib/plan-resolver'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SessionCompare } from '@/components/workout/SessionCompare'
import { ErrorBanner, EmptyState, PageLoader } from '@/components/ux/Feedback'
import { WorkoutCelebrationOverlay } from '@/components/ux/WorkoutCelebrationOverlay'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import { trophyTierFor, trophyShapeFor } from '@/lib/achievements/trophy-tier'
import { LogoMark } from '@/components/brand/Logo'
import { NoticeCard, LogIn } from '@/components/ux/NoticeCard'
import { getProgramProgress } from '@/lib/program-service'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import { getSessionComparison } from '@/lib/session-service'
import { computeBuiltinSessionInsights, type BuiltinSessionInsights } from '@/lib/session-summary-insights'
import { getSummaryActions, shouldShowLoginCloudPrompt } from '@/lib/summary-actions'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { useWorkoutStore } from '@/stores/workout-store'
import { useAppStore } from '@/stores/app-store'
import { daysUntilWorkout } from '@/lib/progress-engine'
import { computeStreakWeeks } from '@/lib/stats-engine'
import { useFrozenWeeks } from '@/lib/streak-freeze'
import { getCycleById } from '@/data/plans'
import type { Program } from '@/data/plans/types'
import { shareSessionCard } from '@/lib/share-card'
import { trackShareCard } from '@/lib/analytics'
import { showToast } from '@/stores/toast-store'
import { releaseBodyScrollLock } from '@/hooks/useFocusTrap'
import { useAchievementUiStore } from '@/stores/achievement-ui-store'
import { AchievementSummaryList } from '@/components/achievements/AchievementSummaryList'
import { WorkoutResultCard } from '@/components/workout/WorkoutResultCard'
import { StreakRecapCard } from '@/components/workout/StreakRecapCard'
import { detectPersonalRecords, type PersonalRecord } from '@/lib/pr-detector'
import { initCelebrationAudio } from '@/lib/celebration-feedback'
import { SessionNoteCard } from '@/components/workout/SessionNoteCard'
import { ChallengeProgressRecap } from '@/components/workout/ChallengeProgressRecap'
import { ProgressionSuggestionPanel } from '@/components/workout/ProgressionSuggestionPanel'
import { analyzeBuiltinProgression, type ProgressionSuggestion } from '@/lib/rpe-analysis'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { generatePostWorkoutInsight } from '@/lib/ai/proactive-coach'
import { resolveAiContextForCall } from '@/lib/ai/managed-client'
import {
  checkRateLimit,
  acquireInflight,
  releaseInflight,
  recordCall,
  recordFailedCall,
} from '@/lib/ai/rate-limiter'
import { listExercises } from '@/lib/custom-plan-service'
import type { LocalAiInsight } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'

export default function SessionSummary() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const failed = searchParams.get('failed') === '1'
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const setHasSeenLoginCloudPrompt = useAppStore((s) => s.setHasSeenLoginCloudPrompt)
  const processedRef = useRef(false)
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
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof getSessionComparison>>['current']>()
  const [previous, setPrevious] = useState<Awaited<ReturnType<typeof getSessionComparison>>['previous']>()
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getProgramProgress>>>(undefined)
  const [insights, setInsights] = useState<BuiltinSessionInsights | undefined>()
  const [coachInsight, setCoachInsight] = useState<LocalAiInsight | null>(null)
  const [sharing, setSharing] = useState(false)
  const [newAchievements, setNewAchievements] = useState<
    import('@/lib/achievements/types').LocalAchievementUnlock[]
  >([])
  const [prRecords, setPrRecords] = useState<PersonalRecord[]>([])
  const [showCelebration, setShowCelebration] = useState(false)
  const [allSessionsForStreak, setAllSessionsForStreak] = useState<LocalWorkoutSession[]>([])
  const [previousSessionsForStreak, setPreviousSessionsForStreak] = useState<LocalWorkoutSession[]>([])
  const frozenWeeks = useFrozenWeeks()
  const [progressionSuggestion, setProgressionSuggestion] = useState<ProgressionSuggestion | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const achievementQueue = useAchievementUiStore((s) => s.queue)
  const clearQueue = useAchievementUiStore((s) => s.clearQueue)
  const setSummaryMode = useAchievementUiStore((s) => s.setSummaryMode)

  // Summary page owns the achievement queue — suppress AchievementHost popups
  useEffect(() => {
    setSummaryMode(true)
    return () => setSummaryMode(false)
  }, [setSummaryMode])

  // Initialize audio context on mount so celebration sound works on iOS PWA
  // (iOS requires AudioContext resume near a user gesture; workout page already
  // unlocked it, but reload-of-summary edge case needs this safety net).
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

  const load = async () => {
    setLoading(true)
    setError(null)
    setInsights(undefined)
    setShowCelebration(false)
    try {
      useWorkoutStore.getState().reset()

      if (!sessionId) {
        setError(pl.missingSession)
        return
      }

      const prog = await getProgramProgress(program)
      setProgress(prog)

      const [comparison, historicalSessions, totalCompletedCount, allCompleted] = await Promise.all([
        getSessionComparison(program, sessionId),
        db.workoutSessions
          .where('program')
          .equals(program)
          .filter((s) => s.status === 'completed')
          .toArray(),
        db.workoutSessions.filter((s) => s.status === 'completed').count(),
        db.workoutSessions.filter((s) => s.status === 'completed').toArray(),
      ])
      setCurrent(comparison.current)
      setPrevious(comparison.previous)
      if (comparison.current) {
        currentSessionIdRef.current = comparison.current.id
        // Streak data: all sessions (including this one) + sessions before this one
        setAllSessionsForStreak(allCompleted)
        setPreviousSessionsForStreak(
          allCompleted.filter((s) => s.id !== comparison.current?.id),
        )
        // Detect personal records for celebration banner
        let records: PersonalRecord[] = []
        try {
          records = await detectPersonalRecords(comparison.current)
          setPrRecords(records)
        } catch {
          setPrRecords([])
        }
        // Trigger celebration overlay on successful completion:
        // - Always for first 3 workouts (onboarding honeymoon)
        // - After that: only when PR, new achievement, or cycle level-up makes it special
        if (!failed) {
          const cycleLevelUp =
            !!comparison.current &&
            !!prog &&
            comparison.current.cycleId !== prog.cycleId
          const isSpecial =
            records.length > 0 || achievementQueue.length > 0 || cycleLevelUp
          const isEarlyWorkout = totalCompletedCount <= 3
          setShowCelebration(isSpecial || isEarlyWorkout)
        }
        setInsights(
          computeBuiltinSessionInsights({
            current: comparison.current,
            previous: comparison.previous,
            historicalSessions,
          }),
        )
        // RPE/RIR progression suggestion (builtin = info-only, cannot modify fixed plans)
        const recentSetsForTrend = historicalSessions
          .filter((s) => s.program === program && s.dayNumber === comparison.current?.dayNumber && s.id !== comparison.current.id)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          .slice(0, 2)
          .map((s) => s.setResults)
        const suggestion = analyzeBuiltinProgression(comparison.current.setResults, recentSetsForTrend)
        setProgressionSuggestion(suggestion)
        setSuggestionDismissed(false)
        // Proactive coach: load or generate post-workout insight
        void loadOrGenerateCoachInsight(comparison.current, comparison.previous, historicalSessions)
      } else {
        setInsights(undefined)
      }
    } catch {
      setError(pl.errorLoadSummary)
    } finally {
      setLoading(false)
    }
  }

  async function loadOrGenerateCoachInsight(
    currentSession: LocalWorkoutSession,
    previousSession: LocalWorkoutSession | undefined,
    historicalSessions: LocalWorkoutSession[],
  ) {
    if (!currentSession) return
    // Reuse any persisted insight — local insights regenerate identically
    // anyway (`previous` for a completed session never changes), so skipping
    // them here prevented a duplicate row per summary view.
    const existing = await db.aiInsights.where('sessionId').equals(currentSession.id).first()
    if (existing && !existing.dismissedAt) {
      setCoachInsight(existing)
      return
    }
    if (existing?.dismissedAt) return // user dismissed it

    const settings = useAppStore.getState().settings
    const aiConfig = settings.aiProactiveCoach
      ? await resolveAiContextForCall(settings)
      : undefined

    // Rate limit check — only for AI calls
    let usedInflight = false
    if (aiConfig) {
      const rl = checkRateLimit('post_workout')
      if (!rl.allowed) {
        // Silently use local fallback for auto-fire
        try {
          const exercises = await listExercises()
          if (coachAbortRef.current?.signal.aborted) return
          const controller = new AbortController()
          coachAbortRef.current = controller
          const insight = await generatePostWorkoutInsight({
            session: currentSession,
            previous: previousSession,
            historicalSessions,
            exercises,
            aiConfig: undefined, // force local
            signal: controller.signal,
          })
          if (currentSession.id !== currentSessionIdRef.current) return
          if (coachAbortRef.current?.signal.aborted) return
          await db.aiInsights.put(insight)
          void enqueueSync('ai_insights', 'insert', insight)
          setCoachInsight(insight)
          // Re-evaluate achievements — ai_first_insight / ai_coach_user count AI insights
          if (insight.source === 'ai') {
            void import('@/lib/achievements/schedule').then((m) => m.scheduleAchievementCheck())
          }
        } catch {
          // Non-blocking
        }
        return
      }
      acquireInflight('post_workout')
      usedInflight = true
    }

    try {
      const exercises = await listExercises()
      // Guard against unmount — don't start AI call if component is gone
      if (coachAbortRef.current?.signal.aborted) return
      // Create abort controller for this AI call — aborted on component unmount
      const controller = new AbortController()
      coachAbortRef.current = controller
      const insight = await generatePostWorkoutInsight({
        session: currentSession,
        previous: previousSession,
        historicalSessions,
        exercises,
        aiConfig,
        signal: controller.signal,
      })
      // Guard against stale state if user navigated away during async generation
      if (currentSession.id !== currentSessionIdRef.current) return
      if (coachAbortRef.current?.signal.aborted) return
      if (insight.source === 'ai') recordCall('post_workout')
      await db.aiInsights.put(insight)
      void enqueueSync('ai_insights', 'insert', insight)
      setCoachInsight(insight)
      // Re-evaluate achievements — ai_first_insight / ai_coach_user count AI insights
      if (insight.source === 'ai') {
        void import('@/lib/achievements/schedule').then((m) => m.scheduleAchievementCheck())
      }
    } catch {
      // AI call failed — count toward quota to prevent retry spam
      if (aiConfig) recordFailedCall('post_workout')
      // Non-blocking — summary works without insight
    } finally {
      if (usedInflight) releaseInflight('post_workout')
    }
  }

  useEffect(() => {
    processedRef.current = false
    loginPromptTrackedRef.current = false
    useWorkoutStore.getState().reset()
    releaseBodyScrollLock()
  }, [program, sessionId, failed])

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
    if (processedRef.current) return
    processedRef.current = true
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when summary identity changes
  }, [program, sessionId, failed])

  const showLoginPrompt =
    !loading &&
    !error &&
    email !== undefined &&
    shouldShowLoginCloudPrompt({
      passed: !failed,
      email,
      hasSeenLoginCloudPrompt,
    })

  useEffect(() => {
    if (!showLoginPrompt || loginPromptTrackedRef.current) return
    loginPromptTrackedRef.current = true
    track(AnalyticsEvents.loginCloudPromptShown)
  }, [showLoginPrompt])

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <PageLoader message={pl.loading} />
      </div>
    )
  }

  if (error) {
    const missing = error === pl.missingSession
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        {missing ? (
          <EmptyState
            icon={<LogoMark size={48} />}
            title={pl.sessionSummaryMissingTitle}
            description={pl.missingSessionHint}
            action={{
              label: pl.backHome,
              onClick: () => navigate('/', { replace: true }),
            }}
          />
        ) : (
          <>
            <ErrorBanner
              message={error}
              onRetry={() => {
                processedRef.current = false
                void load()
              }}
            />
            <Button
              className="mt-4"
              size="touch"
              fullWidth
              onClick={() => navigate('/', { replace: true })}
            >
              {pl.backHome}
            </Button>
          </>
        )}
      </div>
    )
  }

  const rows = current?.setResults ?? []
  const totalReps = current?.totalReps ?? rows.reduce((s, r) => s + r.actual, 0)
  // Ukończony cykl — z sesji (current.cycleId), NIE z progress (który po
  // level-up wskazuje już na nowy cykl). Używany w celebration i result card.
  const cycle = current ? getCycleById(current.cycleId) : undefined
  const daysLeft = daysUntilWorkout(
    progress?.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const summaryActions = getSummaryActions({ failed, progress, program })
  const dismissLoginPrompt = () => setHasSeenLoginCloudPrompt(true)

  // Detekcja przejścia na wyższy cykl: sesja zaliczona, cycleId w progress
  // różni się od cycleId w sesji (completeWorkoutDay ustawił nowy cykl).
  const newCycle = progress ? getCycleById(progress.cycleId) : undefined
  const cycleLevelUp =
    !failed &&
    !!current &&
    !!cycle &&
    !!newCycle &&
    current.cycleId !== progress?.cycleId

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      {/* Workout celebration overlay — full-screen reward on completion */}
      <WorkoutCelebrationOverlay
        active={showCelebration}
        onDismiss={() => setShowCelebration(false)}
        onShare={async () => {
          try {
            await shareSessionCard({
              program,
              dayNumber: current?.dayNumber ?? progress?.currentDay ?? 1,
              totalReps,
              passed: true,
              prCount: insights?.prCount,
              bestSetReps: rows.length > 0 ? Math.max(...rows.map((r) => r.actual)) : undefined,
            })
            trackShareCard(program, true)
            showToast(pl.summaryShareDone, 'success')
          } catch {
            showToast(pl.summaryShareFailed, 'error')
          }
        }}
        contextLabel={
          cycle
            ? pl.celebrationDayContext(current?.dayNumber ?? 1, cycle.days.length)
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
        achievementTrophyShape={
          newAchievements.length > 0
            ? (() => {
                const u = newAchievements[0]!
                const def = ACHIEVEMENT_BY_ID[u.id]
                if (!def) return 'cup' as const
                return trophyShapeFor(def)
              })()
            : 'cup'
        }
        stats={[
          { icon: Flame, value: totalReps, label: pl.celebrationStatReps, animate: true },
          { icon: Dumbbell, value: rows.length, label: pl.celebrationStatSets, animate: true },
        ]}
        streakWeeks={computeStreakWeeks(allSessionsForStreak.filter((s) => s.status === 'completed'), new Date(), frozenWeeks)}
        streakIncreased={
          computeStreakWeeks(allSessionsForStreak.filter((s) => s.status === 'completed'), new Date(), frozenWeeks) >
          computeStreakWeeks(previousSessionsForStreak.filter((s) => s.status === 'completed'), new Date(), frozenWeeks)
        }
        streakMilestoneReached={(() => {
          const newS = computeStreakWeeks(allSessionsForStreak.filter((s) => s.status === 'completed'), new Date(), frozenWeeks)
          const prevS = computeStreakWeeks(previousSessionsForStreak.filter((s) => s.status === 'completed'), new Date(), frozenWeeks)
          for (const m of [4, 8, 12, 26, 52]) {
            if (prevS < m && newS >= m) return m
          }
          return null
        })()}
      />

      {/* WorkoutResultCard is the single status header — the h1 stays for
          screen readers only so the "day completed" message isn't repeated. */}
      <h1 className="sr-only">
        {failed ? pl.dayFailed : pl.dayComplete(current?.dayNumber ?? 1)}
      </h1>

      {/* Unified workout result card — status + PR + AI + CTA in one cohesive unit */}
      <WorkoutResultCard
        className="mb-6"
        failed={failed}
        title={failed ? pl.summaryHeroFail : pl.summaryHeroSuccess}
        subtitle={`${getProgramLabel(program)}${cycle ? ` · ${cycle.nameShort}` : ''} · ${pl.attemptShort(current?.cycleAttempt ?? progress?.cycleAttempt ?? 1)}${
          !failed && progress && progress.status !== 'test_pending'
            ? ` · ${pl.nextWorkoutIn(daysLeft)}`
            : ''
        }`}
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
        primaryLabel={pl.backHome}
        onPrimaryAction={() => navigate('/', { replace: true })}
        shareLabel={pl.summaryShare}
        shareDisabled={sharing}
        onShare={async () => {
          setSharing(true)
          try {
            await shareSessionCard({
              program,
              dayNumber: current?.dayNumber ?? progress?.currentDay ?? 1,
              totalReps,
              passed: true,
              prCount: insights?.prCount,
              bestSetReps: rows.length > 0 ? Math.max(...rows.map((r) => r.actual)) : undefined,
            })
            trackShareCard(program, true)
            showToast(pl.summaryShareDone, 'success')
          } catch {
            showToast(pl.summaryShareFailed, 'error')
          } finally {
            setSharing(false)
          }
        }}
      />

      {/* Streak recap — celebrate streak increase after workout */}
      {!failed && (
        <StreakRecapCard
          sessions={allSessionsForStreak}
          previousSessions={previousSessionsForStreak}
        />
      )}

      {/* Challenge progress recap — show how this workout contributed */}
      {!failed && <ChallengeProgressRecap program={program} session={current ?? null} />}

      {/* Achievements — celebration moment, keep near result card */}
      {newAchievements.length > 0 && (
        <div className="mb-6">
          <SectionHeader icon={Award} title={pl.summarySectionAchievements} />
          <AchievementSummaryList unlocks={newAchievements} />
        </div>
      )}

      {/* Cycle level-up card — motywacyjny komunikat przejścia na wyższy poziom */}
      {cycleLevelUp && cycle && newCycle && (
        <Card className="mb-6 overflow-hidden border-0 p-0">
          <div
            className="p-5"
            style={{
              backgroundImage: 'linear-gradient(135deg, var(--sr-brand-primary) 0%, var(--sr-brand-secondary) 100%)',
            }}
          >
            <div className="flex items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-white/20 text-white"
                aria-hidden
              >
                <TrendingUp size={24} strokeWidth={2.5} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{pl.cycleLevelUpTitle}</p>
                <p className="mt-1 sr-text-body-sm text-white/90">
                  {pl.cycleLevelUpBody(cycle.nameShort, newCycle.nameShort)}
                </p>
                <p className="mt-1.5 sr-text-caption text-white/75">
                  {pl.cycleLevelUpMotivation}
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Cycle complete card with icon */}
      {!failed && progress?.status === 'test_pending' && (
        <Card className="mb-6 border border-[var(--sr-brand-primary)]/40 bg-[var(--sr-brand-primary-muted)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary)]/15 text-[var(--sr-brand-primary)]" aria-hidden>
              <Trophy size={20} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--sr-text-primary)]">{pl.cycleComplete}</p>
              <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.cycleCompleteHint}</p>
              <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.summaryRecCycleDone}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Button size="touch" fullWidth onClick={() => navigate(`/setup/test/${program}?retest=1`)}>
              {pl.retestNow}
            </Button>
            {summaryActions.secondary.map((action) => (
              <Button
                key={action.label}
                size="touch"
                fullWidth
                variant={action.variant ?? 'secondary'}
                onClick={() => action.onClick({ navigate })}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      {/* Failed info card with icon */}
      {failed && (
        <Card className="mb-6 border border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)] p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-error)]/15 text-[var(--sr-error)]" aria-hidden>
              <AlertTriangle size={20} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="sr-text-body-sm font-medium text-[var(--sr-error)]">
                {pl.dayFailedRestart(progress?.cycleAttempt ?? 1)}
              </p>
              <p className="mt-1.5 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.summaryRecFail}</p>
              <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.restPrimaryLabel(pl.restIn(daysLeft))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats section */}
      <div className="mt-6">
        <SectionHeader icon={BarChart3} title={pl.summarySectionStats} />
        <SessionCompare
          rows={rows}
          previousRows={previous?.setResults}
          totalReps={totalReps}
          previousTotalReps={previous?.totalReps ?? null}
          insights={insights}
          startedAt={current?.startedAt}
          completedAt={current?.completedAt}
        />
      </div>

      {/* RPE/RIR progression suggestion (builtin = info-only) */}
      {progressionSuggestion && !suggestionDismissed && !failed && (
        <ProgressionSuggestionPanel
          suggestion={progressionSuggestion}
          canApply={false}
          onDismiss={() => setSuggestionDismissed(true)}
        />
      )}

      {/* Notes section */}
      {current?.id && (
        <div className="mt-6">
          <SectionHeader icon={StickyNote} title={pl.summarySectionNotes} />
          <SessionNoteCard sessionId={current.id} />
        </div>
      )}

      {/* Login prompt */}
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
            track(AnalyticsEvents.loginCloudPromptClicked)
            navigate('/setup/login', {
              state: { returnTo: `/workout/${program}/summary?session=${sessionId}` },
            })
          }}
          dismissLabel={pl.standaloneLoginCoachDismiss}
          onDismiss={dismissLoginPrompt}
          stackActions
        />
      )}

      {/* Secondary actions — at the bottom (primary CTA is in result card) */}
      {summaryActions.secondary.length > 0 && progress?.status !== 'test_pending' && (
        <div className="mt-8 flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] pt-6">
          {summaryActions.secondary.map((action) => (
            <Button
              key={action.label}
              size="touch"
              fullWidth
              variant={action.variant ?? 'secondary'}
              onClick={() => action.onClick({ navigate })}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
