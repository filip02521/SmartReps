import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { CycleDayRail } from '@/components/ui/CycleDayRail'
import { CycleCelebration } from '@/components/workout/WorkoutComponents'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ux/Feedback'
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
  const [searchParams] = useSearchParams()
  const isRetestUrl = searchParams.get('retest') === '1'
  const isLevelChangeUrl = searchParams.get('change') === '1'
  const { pendingStart, pendingTest, setPendingStart, setPendingTest, clearPendingStart } = useAppStore()
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()
  const leavingRef = useRef(false)
  const [dismissedCelebration, setDismissedCelebration] = useState(false)
  const [restDays, setRestDays] = useState<number | null>(null)
  const [restReady, setRestReady] = useState(false)

  const isRetest = isRetestUrl || !!pendingStart?.isRetest
  const isLevelChange = isLevelChangeUrl || !!pendingStart?.isLevelChange
  const modeQuery = isRetest ? '?retest=1' : isLevelChange ? '?change=1' : ''

  useEffect(() => {
    if (!hydrated || leavingRef.current) return
    if (pendingTest?.program === program && !pendingStart) return
    if (!pendingStart || pendingStart.program !== program) {
      if (isLevelChange) {
        navigate(`/setup/cycle/${program}?change=1`, { replace: true })
      } else {
        navigate(`/setup/test/${program}${isRetest ? '?retest=1' : ''}`, { replace: true })
      }
    }
  }, [hydrated, pendingStart, pendingTest, program, navigate, isRetest, isLevelChange])

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
        <PageLoader message={pl.restoringSetup} />
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
        <PageLoader compact />
      </div>
    )
  }

  const cycle = getCycleById(pendingStart.cycleId)
  const day1 = cycle?.days[0]
  const inRest = (restDays ?? 0) > 0

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      {!isLevelChange && !isRetest && <SetupStepper current="start" />}
      <PageHeader
        title={isLevelChange ? pl.levelChangeReady : pl.programReady}
        subtitle={pl.programReadySubtitle(
          program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram,
          pendingStart.cycleName,
        )}
      />

      {isLevelChange && (
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{pl.levelChangeHint}</p>
      )}

      <CycleDayRail
        className="mt-2"
        totalDays={cycle?.days.length ?? 1}
        days={(cycle?.days ?? []).map((d) => ({
          dayNumber: d.dayNumber,
          status: d.dayNumber === 1 ? 'current' : 'future',
        }))}
      />
      <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
        {pl.dayOfTotal(1, cycle?.days.length ?? 1)}
      </p>

      {inRest && (
        <Card className="mt-4 border border-[var(--sr-warning)] sr-card">
          <p className="text-sm text-[var(--sr-warning)]">
            {isLevelChange ? pl.levelChangeRestHint : pl.postTestRest}
          </p>
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
          setPendingStart({
            ...pendingStart,
            navigateToWorkout: !inRest,
            isRetest,
            isLevelChange,
          })
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
          if (isLevelChange) {
            clearPendingStart()
            navigate(`/setup/cycle/${program}?change=1`, { replace: true })
            return
          }
          setPendingTest({
            program: start.program,
            reps: start.reps ?? 1,
            cycleId: start.cycleId,
            committedMaxTestId: start.committedMaxTestId,
          })
          clearPendingStart()
          navigate(`/setup/cycle/${program}${modeQuery}`, { replace: true })
        }}
      >
        {pl.backToPicker}
      </Button>
    </div>
  )
}
