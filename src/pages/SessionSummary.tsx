import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Trophy, AlertTriangle, CalendarClock } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SessionCompare } from '@/components/workout/SessionCompare'
import { ErrorBanner, EmptyState, PageLoader } from '@/components/ux/Feedback'
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
import { SessionNoteCard } from '@/components/workout/SessionNoteCard'
import { AiInsightCard } from '@/components/brand/AiInsightCard'
import { generatePostWorkoutInsight } from '@/lib/ai/proactive-coach'
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
  const achievementQueue = useAchievementUiStore((s) => s.queue)
  const clearQueue = useAchievementUiStore((s) => s.clearQueue)
  const setSummaryMode = useAchievementUiStore((s) => s.setSummaryMode)

  // Summary page owns the achievement queue — suppress AchievementHost popups
  useEffect(() => {
    setSummaryMode(true)
    return () => setSummaryMode(false)
  }, [setSummaryMode])

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
    try {
      useWorkoutStore.getState().reset()

      if (!sessionId) {
        setError(pl.missingSession)
        return
      }

      const prog = await getProgramProgress(program)
      setProgress(prog)

      const [comparison, historicalSessions] = await Promise.all([
        getSessionComparison(program, sessionId),
        db.workoutSessions
          .where('program')
          .equals(program)
          .filter((s) => s.status === 'completed' && s.passed === true)
          .toArray(),
      ])
      setCurrent(comparison.current)
      setPrevious(comparison.previous)
      if (comparison.current) {
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
    const existing = await db.aiInsights.where('sessionId').equals(currentSession.id).first()
    if (existing && !existing.dismissedAt) {
      setCoachInsight(existing)
      return
    }
    if (existing?.dismissedAt) return // user dismissed it

    const settings = useAppStore.getState().settings
    const aiConfig = settings.aiProactiveCoach && settings.aiApiKey
      ? { apiKey: settings.aiApiKey, model: settings.aiModel ?? 'gpt-4o-mini', baseURL: settings.aiBaseUrl || undefined }
      : undefined

    try {
      const exercises = await listExercises()
      const insight = await generatePostWorkoutInsight({
        session: currentSession,
        previous: previousSession,
        historicalSessions,
        exercises,
        aiConfig,
      })
      // Guard against stale state if user navigated away during async generation
      if (currentSession.id !== current?.id) return
      await db.aiInsights.put(insight)
      void enqueueSync('ai_insights', 'insert', insight)
      setCoachInsight(insight)
    } catch {
      // Non-blocking — summary works without insight
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
      <PageHeader
        title={failed ? pl.dayFailed : pl.dayComplete(current?.dayNumber ?? 1)}
        subtitle={`${program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}${
          !failed && progress && progress.status !== 'test_pending'
            ? ` · ${pl.nextWorkoutIn(daysLeft)}`
            : ''
        }`}
      />

      {/* Hero status banner */}
      <div
        className={cn(
          'mb-6 flex items-center gap-3 rounded-[var(--sr-radius-lg)] border p-4',
          failed
            ? 'border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)]'
            : 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)]',
        )}
      >
        <span
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
            failed
              ? 'bg-[var(--sr-error)]/15 text-[var(--sr-error)]'
              : 'bg-[var(--sr-success)]/15 text-[var(--sr-success)]',
          )}
          aria-hidden
        >
          {failed ? <XCircle size={24} strokeWidth={2.25} /> : <CheckCircle2 size={24} strokeWidth={2.25} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--sr-text-primary)]">
            {failed ? pl.summaryHeroFail : pl.summaryHeroSuccess}
          </p>
          <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}
            {cycle ? ` · ${cycle.nameShort}` : ''}
            {` · ${pl.attemptShort(current?.cycleAttempt ?? progress?.cycleAttempt ?? 1)}`}
          </p>
        </div>
      </div>

      {/* Proactive coach insight */}
      {coachInsight && (
        <AiInsightCard
          insight={coachInsight}
          className="mb-6"
          onDismiss={async () => {
            const dismissed = { ...coachInsight, dismissedAt: new Date().toISOString() }
            await db.aiInsights.put(dismissed)
            void enqueueSync('ai_insights', 'update', dismissed)
            setCoachInsight(null)
            showToast(pl.coachPostWorkoutDismissed, 'info')
          }}
        />
      )}

      {/* Cycle complete card with icon */}
      {!failed && progress?.status === 'test_pending' && (
        <Card className="mb-6 border border-[var(--sr-brand-primary)]/40 bg-[var(--sr-brand-primary-muted)]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary)]/15 text-[var(--sr-brand-primary)]" aria-hidden>
              <Trophy size={20} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-[var(--sr-text-primary)]">{pl.cycleComplete}</p>
              <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.cycleCompleteHint}</p>
              <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.summaryRecCycleDone}</p>
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
        <div className="mb-6 flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3">
          <CalendarClock size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.nextWorkoutIn(daysLeft)}
          </p>
        </div>
      )}

      {/* Failed info card with icon */}
      {failed && (
        <Card className="mb-6 border border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-error)]/15 text-[var(--sr-error)]" aria-hidden>
              <AlertTriangle size={20} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--sr-error)]">
                {pl.dayFailedRestart(progress?.cycleAttempt ?? 1)}
              </p>
              <p className="mt-1.5 text-sm text-[var(--sr-text-secondary)]">{pl.summaryRecFail}</p>
              <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
                {pl.restPrimaryLabel(pl.restIn(daysLeft))}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Stats section */}
      <div className="mt-6">
        <h2 className="mb-3 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
          {pl.summarySectionStats}
        </h2>
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
          <h2 className="mb-3 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.summarySectionNotes}
          </h2>
          <SessionNoteCard sessionId={current.id} />
        </div>
      )}

      {/* Achievements section */}
      {newAchievements.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.summarySectionAchievements}
          </h2>
          <AchievementSummaryList unlocks={newAchievements} />
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

      {/* Action buttons — at the bottom */}
      <div className="mt-8 flex flex-col gap-2">
        <Button size="touch" fullWidth onClick={() => navigate('/', { replace: true })}>
          {pl.backHome}
        </Button>
        {!failed && (
          <Button
            variant="secondary"
            size="touch"
            fullWidth
            disabled={sharing}
            onClick={() => {
              void (async () => {
                setSharing(true)
                try {
                  await shareSessionCard({
                    program,
                    dayNumber: current?.dayNumber ?? progress?.currentDay ?? 1,
                    totalReps,
                    passed: true,
                  })
                  trackShareCard(program, true)
                  showToast(pl.summaryShareDone, 'success')
                } catch {
                  showToast(pl.summaryShareFailed, 'error')
                } finally {
                  setSharing(false)
                }
              })()
            }}
          >
            {pl.summaryShare}
          </Button>
        )}
        {summaryActions.secondary.length > 0 && progress?.status !== 'test_pending' &&
          summaryActions.secondary.map((action) => (
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
    </div>
  )
}
