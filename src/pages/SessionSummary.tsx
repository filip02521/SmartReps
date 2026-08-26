import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { pl } from '@/i18n/pl'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SessionCompare } from '@/components/workout/SessionCompare'
import { ErrorBanner, SkeletonCard } from '@/components/ux/Feedback'
import { getProgramProgress } from '@/lib/program-service'
import { getSessionComparison } from '@/lib/session-service'
import { useWorkoutStore } from '@/stores/workout-store'
import { daysUntilWorkout } from '@/lib/progress-engine'
import { getCycleById } from '@/data/plans'
import type { Program } from '@/data/plans/types'
import { showToast } from '@/stores/toast-store'

export default function SessionSummary() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const failed = searchParams.get('failed') === '1'
  const sessionId = searchParams.get('session')
  const navigate = useNavigate()
  const store = useWorkoutStore()
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
      store.reset()
      const prog = await getProgramProgress(program)
      setProgress(prog)

      if (sessionId) {
        const comparison = await getSessionComparison(program, sessionId)
        setCurrent(comparison.current)
        setPrevious(comparison.previous)
      }

      if (!failed && prog?.status === 'test_pending') {
        // Cycle complete — retest celebration happens after max test in ProgramStart
      } else if (!failed && sessionId) {
        showToast(pl.toastDayComplete, 'success')
      }
    } catch {
      setError('Nie udało się załadować podsumowania.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (processedRef.current) return
    processedRef.current = true
    void load()
  }, [program, sessionId, failed, store])

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <SkeletonCard className="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <ErrorBanner message={error} onRetry={() => void load()} />
      </div>
    )
  }

  const rows = current?.setResults ?? store.setResults
  const totalReps = current?.totalReps ?? rows.reduce((s, r) => s + r.actual, 0)
  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const daysLeft = daysUntilWorkout(progress?.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null)

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <h1 className="sr-text-h1">
        {failed ? pl.dayFailed : pl.dayComplete(current?.dayNumber ?? 1)}
      </h1>
      <p className="mt-1 text-[var(--sr-text-secondary)]">
        SmartReps · {program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}
      </p>

      {!failed && progress?.status === 'test_pending' && (
        <Card className="mt-4 border border-[var(--sr-brand-primary)] sr-card">
          <p className="font-semibold">{pl.cycleComplete}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.cycleCompleteHint}</p>
        </Card>
      )}

      {!failed && progress && (
        <p className="mt-3 text-sm text-[var(--sr-text-secondary)]">{pl.nextWorkoutIn(daysLeft)}</p>
      )}

      {failed && (
        <Card className="mt-4 border border-[var(--sr-error)] sr-card">
          <p className="text-sm text-[var(--sr-error)]">
            Po przerwie wrócisz do dnia 1 tego cyklu (próba {(progress?.cycleAttempt ?? 1)}).
          </p>
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
        <p className="mt-2 text-center text-xs text-[var(--sr-text-muted)]">
          {cycle.nameShort} · Próba {current?.cycleAttempt ?? progress?.cycleAttempt}
        </p>
      )}

      <Button className="mt-8" fullWidth onClick={() => navigate('/')}>
        {pl.backHome}
      </Button>
    </div>
  )
}
