import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Trophy, AlertTriangle, CalendarClock, Flame, Dumbbell, BarChart3, StickyNote, Award } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SessionCompare } from '@/components/workout/SessionCompare'
import { ErrorBanner, EmptyState, PageLoader } from '@/components/ux/Feedback'
import { WorkoutCelebrationOverlay } from '@/components/ux/WorkoutCelebrationOverlay'
import { LogoMark } from '@/components/brand/Logo'
import { NoticeCard, LogIn } from '@/components/ux/NoticeCard'
import { getProgramProgress } from '@/lib/program-service'
import { db } from '@/lib/db'
import type { LocalWorkoutSession } from '@/lib/db'
import { getSessionComparison } from '@/lib/session-service'
import { computeBuiltinSessionInsights, type BuiltinSessionInsights } from '@/lib/session-summary-insights'
import { getSummaryActions, shouldShowLoginCloudPrompt } from '@/lib/summary-actions'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'
import { useWorkoutStore } from '@/stores/workout-store'
import { useAppStore } from '@/stores/app-store'
import { daysUntilWorkout } from '@/lib/progress-engine'
import { getCycleById } from '@/data/plans'
import type { Program } from '@/data/plans/types'
import { shareSessionCard } from '@/lib/share-card'
import { trackShareCard } from '@/lib/analytics'
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
  const setResults = useWorkoutStore((s) => s.setResults)
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

      const [comparison, historicalSessions, totalCompletedCount] = await Promise.all([
        getSessionComparison(program, sessionId),
        db.workoutSessions
          .where('program')
          .equals(program)
          .filter((s) => s.status === 'completed')
          .toArray(),
        db.workoutSessions.filter((s) => s.status === 'completed').count(),
      ])
      setCurrent(comparison.current)
      setPrevious(comparison.previous)
      if (comparison.current) {
        currentSessionIdRef.current = comparison.current.id
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
        // - After that: only when PR or new achievement makes it special
        if (!failed) {
          const isSpecial = records.length > 0 || achievementQueue.length > 0
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
    // Check if insight already exists for this session
    // Only cache AI insights — local insights are cheap to regenerate and
    // depend on `previous` which can change as more sessions are completed.
    const existing = await db.aiInsights.where('sessionId').equals(currentSession.id).first()
    if (existing && !existing.dismissedAt && existing.source === 'ai') {
      setCoachInsight(existing)
      return
    }
    if (existing?.dismissedAt) return // user dismissed it

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
    } catch {
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
    track('login_cloud_prompt_shown')
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

  const rows = current?.setResults ?? setResults
  const totalReps = current?.totalReps ?? rows.reduce((s, r) => s + r.actual, 0)
  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const daysLeft = daysUntilWorkout(
    progress?.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  const summaryActions = getSummaryActions({ failed, progress, program })
  const dismissLoginPrompt = () => setHasSeenLoginCloudPrompt(true)

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
        stats={[
          { icon: Flame, value: totalReps, label: pl.celebrationStatReps, animate: true },
          { icon: Dumbbell, value: rows.length, label: pl.celebrationStatSets, animate: true },
        ]}
      />

      <PageHeader
        title={failed ? pl.dayFailed : pl.dayComplete(current?.dayNumber ?? 1)}
        subtitle={`${program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}${
          !failed && progress && progress.status !== 'test_pending'
            ? ` · ${pl.nextWorkoutIn(daysLeft)}`
            : ''
        }`}
      />

      {/* Unified workout result card — status + PR + AI + CTA in one cohesive unit */}
      <WorkoutResultCard
        className="mb-6"
        failed={failed}
        title={failed ? pl.summaryHeroFail : pl.summaryHeroSuccess}
        subtitle={`${program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}${cycle ? ` · ${cycle.nameShort}` : ''} · ${pl.attemptShort(current?.cycleAttempt ?? progress?.cycleAttempt ?? 1)}`}
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

      {/* Achievements — celebration moment, keep near result card */}
      {newAchievements.length > 0 && (
        <div className="mb-6">
          <SectionHeader icon={Award} title={pl.summarySectionAchievements} />
          <AchievementSummaryList unlocks={newAchievements} />
        </div>
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

      {/* Rest recommendation — styled info card */}
      {!failed && progress && progress.status !== 'test_pending' && progress.nextWorkoutAfter && (
        <div className="mb-6 flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-4">
          <CalendarClock size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.nextWorkoutIn(daysLeft)}
          </p>
        </div>
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
            track('login_cloud_prompt_clicked')
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
