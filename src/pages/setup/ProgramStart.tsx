import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CycleCelebration } from '@/components/workout/WorkoutComponents'
import { SkeletonCard } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { getCycleById } from '@/data/plans'
import { getProgramProgress } from '@/lib/program-service'
import { formatSetTarget, isWorkoutAvailable, daysUntilWorkout } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'

export default function ProgramStart() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const { pendingStart, setPendingStart, setPendingTest, clearPendingStart } = useAppStore()
  const navigate = useNavigate()
  const [dismissedCelebration, setDismissedCelebration] = useState(false)
  const [restDays, setRestDays] = useState<number | null>(null)
  const [restReady, setRestReady] = useState(false)

  useEffect(() => {
    if (!pendingStart || pendingStart.program !== program) {
      navigate(`/setup/test/${program}`)
    }
  }, [pendingStart, program, navigate])

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

  if (!pendingStart) return null

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
      <h1 className="text-2xl font-bold">{pl.programReady}</h1>
      <p className="mt-2 text-[var(--sr-text-secondary)]">
        {program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram} · Cykl {pendingStart.cycleName}
      </p>

      <div className="mt-4 flex gap-1">
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
              <li key={i}>Seria {i + 1}: {formatSetTarget(s)} · przerwa {day1.restBetweenSetsSec}s</li>
            ))}
          </ul>
        </Card>
      )}

      <Button
        className="mt-8"
        fullWidth
        onClick={() => {
          setPendingStart({ ...pendingStart, navigateToWorkout: !inRest })
          navigate('/setup/login')
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
          setPendingTest({
            program: start.program,
            reps: start.reps ?? 1,
            cycleId: start.cycleId,
            committedMaxTestId: start.committedMaxTestId,
          })
          clearPendingStart()
          const retest = start.isRetest ? '?retest=1' : ''
          navigate(`/setup/cycle/${program}${retest}`)
        }}
      >
        {pl.backToPicker}
      </Button>
    </div>
  )
}
