import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pl } from '@/i18n/pl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SessionCompare } from '@/components/workout/SessionCompare'
import { ErrorBanner, EmptyState, PageLoader } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { NoticeCard, LogIn } from '@/components/ux/NoticeCard'
import { getProgramProgress } from '@/lib/program-service'
import { db } from '@/lib/db'
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
  const [sharing, setSharing] = useState(false)

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
      } else {
        setInsights(undefined)
      }
    } catch {
      setError(pl.errorLoadSummary)
    } finally {
      setLoading(false)
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

      {!failed && progress?.status === 'test_pending' && (
        <Card className="mt-4 border border-[var(--sr-brand-primary)]">
          <p className="font-semibold">{pl.cycleComplete}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.cycleCompleteHint}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.summaryRecCycleDone}</p>
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

      {!failed && progress && progress.status !== 'test_pending' && !progress.nextWorkoutAfter && (
        <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.summaryRecSuccess}</p>
      )}

      {failed && (
        <Card className="mt-4 border border-[var(--sr-error)]">
          <p className="text-sm text-[var(--sr-error)]">
            {pl.dayFailedRestart(progress?.cycleAttempt ?? 1)}
          </p>
          <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.summaryRecFail}</p>
          <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">
            {pl.restPrimaryLabel(pl.restIn(daysLeft))}
          </p>
        </Card>
      )}

      <div className="mt-6">
        <SessionCompare
          rows={rows}
          previousRows={previous?.setResults}
          totalReps={totalReps}
          previousTotalReps={previous?.totalReps ?? null}
          insights={insights}
        />
      </div>

      {cycle && (
        <p className="mt-3 text-center sr-text-body-sm text-[var(--sr-text-secondary)]">
          {cycle.nameShort} ·{' '}
          {pl.attemptShort(current?.cycleAttempt ?? progress?.cycleAttempt ?? 1)}
        </p>
      )}

      {summaryActions.secondary.length > 0 && progress?.status !== 'test_pending' && (
        <div className="mt-4 flex flex-col gap-2">
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

      <div className="mt-6 flex flex-col gap-2">
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
        <Button size="touch" fullWidth onClick={() => navigate('/', { replace: true })}>
          {pl.backHome}
        </Button>
      </div>
    </div>
  )
}
