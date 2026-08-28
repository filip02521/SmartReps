import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pl } from '@/i18n/pl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { SessionCompare } from '@/components/workout/SessionCompare'
import { ErrorBanner, PageLoader } from '@/components/ux/Feedback'
import { getProgramProgress } from '@/lib/program-service'
import { getSessionComparison } from '@/lib/session-service'
import { useWorkoutStore } from '@/stores/workout-store'
import { daysUntilWorkout } from '@/lib/progress-engine'
import { getCycleById } from '@/data/plans'
import type { Program } from '@/data/plans/types'

export default function SessionSummary() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const failed = searchParams.get('failed') === '1'
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()
  const setResults = useWorkoutStore((s) => s.setResults)
  const processedRef = useRef(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<Awaited<ReturnType<typeof getSessionComparison>>['current']>()
  const [previous, setPrevious] = useState<Awaited<ReturnType<typeof getSessionComparison>>['previous']>()
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getProgramProgress>>>(undefined)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      useWorkoutStore.getState().reset()

      if (!sessionId) {
        setError(pl.missingSession)
        return
      }

      const prog = await getProgramProgress(program)
      setProgress(prog)

      const comparison = await getSessionComparison(program, sessionId)
      setCurrent(comparison.current)
      setPrevious(comparison.previous)
    } catch {
      setError(pl.errorLoadSummary)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    processedRef.current = false
  }, [program, sessionId, failed])

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when summary identity changes
  }, [program, sessionId, failed])

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <PageLoader />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
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
      </div>
    )
  }

  const rows = current?.setResults ?? setResults
  const totalReps = current?.totalReps ?? rows.reduce((s, r) => s + r.actual, 0)
  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const daysLeft = daysUntilWorkout(
    progress?.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )

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
          <Button
            className="mt-4"
            size="touch"
            fullWidth
            onClick={() => navigate(`/setup/test/${program}?retest=1`)}
          >
            {pl.retestNow}
          </Button>
        </Card>
      )}

      {!failed && progress && progress.status !== 'test_pending' && (
        <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.summaryRecSuccess}</p>
      )}

      {failed && (
        <Card className="mt-4 border border-[var(--sr-error)]">
          <p className="text-sm text-[var(--sr-error)]">
            {pl.dayFailedRestart(progress?.cycleAttempt ?? 1)}
          </p>
          <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.summaryRecFail}</p>
        </Card>
      )}

      <div className="mt-6">
        <SessionCompare
          rows={rows}
          previousRows={previous?.setResults}
          totalReps={totalReps}
          previousTotalReps={previous?.totalReps ?? null}
        />
      </div>

      {cycle && (
        <p className="mt-3 text-center sr-text-body-sm text-[var(--sr-text-secondary)]">
          {cycle.nameShort} ·{' '}
          {pl.attemptShort(current?.cycleAttempt ?? progress?.cycleAttempt ?? 1)}
        </p>
      )}

      <Button className="mt-8" size="touch" fullWidth onClick={() => navigate('/', { replace: true })}>
        {pl.backHome}
      </Button>
    </div>
  )
}
