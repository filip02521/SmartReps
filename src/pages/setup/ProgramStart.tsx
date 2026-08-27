import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CycleCelebration } from '@/components/workout/WorkoutComponents'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { getCycleById } from '@/data/plans'
import { getProgramProgress } from '@/lib/program-service'
import { formatSetTarget, isWorkoutAvailable, daysUntilWorkout } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'

export default function ProgramStart() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const { pendingStart, pendingTest, setPendingStart, setPendingTest, clearPendingStart } = useAppStore()
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()
  const leavingRef = useRef(false)
  const [dismissedCelebration, setDismissedCelebration] = useState(false)
  const [restDays, setRestDays] = useState<number | null>(null)
  const [restReady, setRestReady] = useState(false)

  useEffect(() => {
    if (!hydrated || leavingRef.current) return
    // Back-to-picker sets pendingTest then navigates explicitly — don't fight it
    if (pendingTest?.program === program && !pendingStart) return
    if (!pendingStart || pendingStart.program !== program) {
      navigate(`/setup/test/${program}`, { replace: true })
    }
  }, [hydrated, pendingStart, pendingTest, program, navigate])

  useEffect(() => {
    let cancelled = false
    setRestReady(false)
    getProgramProgress(program).then((p) => {
      if (cancelled) return
      if (p?.nextWorkoutAfter && !isWorkoutAvailable(new Date(p.nextWorkoutAfter))) {
        setRestDays(daysUntilWorkout(new Date(p.nextWorkoutAfter)))
      } else {
        setRestDays(0)
      }
      setRestReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [program])

  if (!hydrated || !pendingStart || pendingStart.program !== program) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <SkeletonCard className="h-48" />
        <p className="mt-4 text-center text-sm text-[var(--sr-text-muted)]">{pl.restoringSetup}</p>
      </div>
    )
  }

  if (!dismissedCelebration && pendingStart.celebration) {
    return (
      <CycleCelebration
        message={pendingStart.celebration}
        onDismiss={() => setDismissedCelebration(true)}
      />
    )
  }

  if (!restReady) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <SkeletonCard className="h-48" />
      </div>
    )
  }

  const cycle = getCycleById(pendingStart.cycleId)
  const day1 = cycle?.days[0]
  const inRest = (restDays ?? 0) > 0

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <SetupStepper current="start" />
      <PageHeader
        title={pl.programReady}
        subtitle={`${program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram} · Cykl ${pendingStart.cycleName}`}
      />

      <div className="mt-2 flex gap-1" role="list" aria-label={pl.cycleDays}>
        {cycle?.days.map((d) => (
          <div
            key={d.dayNumber}
            className="h-1.5 flex-1 rounded-full"
            style={{ background: d.dayNumber === 1 ? 'var(--sr-brand-primary)' : 'var(--sr-bg-surface)' }}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-[var(--sr-text-muted)]">Dzień 1/{cycle?.days.length}</p>

      {inRest && (
        <Card className="mt-4 border border-[var(--sr-warning)] sr-card">
          <p className="text-sm text-[var(--sr-warning)]">{pl.postTestRest}</p>
          <p className="mt-1 text-xs text-[var(--sr-text-muted)]">{pl.nextWorkoutIn(restDays!)}</p>
        </Card>
      )}

      {day1 && (
        <Card className="mt-6 sr-card">
          <p className="font-medium">{pl.firstTraining}</p>
          <ul className="mt-3 space-y-1 text-sm text-[var(--sr-text-secondary)]">
            {day1.sets.map((s, i) => (
              <li key={i}>
                {pl.setColumn} {i + 1}: {formatSetTarget(s)} · {pl.restBetweenSets(day1.restBetweenSetsSec)}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Button
        className="mt-8"
        fullWidth
        onClick={() => {
          leavingRef.current = true
          setPendingStart({ ...pendingStart, navigateToWorkout: !inRest })
          navigate('/setup/login', { replace: true })
        }}
      >
        {inRest ? pl.continueToLogin : pl.startDay1}
      </Button>
      <Button
        variant="ghost"
        className="mt-2"
        fullWidth
        onClick={() => {
          const start = pendingStart
          leavingRef.current = true
          setPendingTest({
            program: start.program,
            reps: start.reps ?? 1,
            cycleId: start.cycleId,
            committedMaxTestId: start.committedMaxTestId,
          })
          clearPendingStart()
          const retest = start.isRetest ? '?retest=1' : ''
          navigate(`/setup/cycle/${program}${retest}`, { replace: true })
        }}
      >
        {pl.backToPicker}
      </Button>
    </div>
  )
}
