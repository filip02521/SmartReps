import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { selectCycleByTest } from '@/lib/cycle-selector'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'

export function HealthDisclaimer({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sr-bg-overlay)] p-4" role="dialog" aria-modal="true" aria-labelledby="health-title">
      <div className="max-w-sm rounded-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] p-6">
        <h2 id="health-title" className="text-lg font-semibold">{pl.healthTitle}</h2>
        <p className="mt-3 text-sm text-[var(--sr-text-secondary)]">{pl.healthDisclaimer}</p>
        <label className="mt-4 flex min-h-11 items-start gap-3 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-1 h-5 w-5" />
          {pl.healthAccept}
        </label>
        <Button className="mt-6" fullWidth disabled={!checked} onClick={onAccept}>{pl.confirm}</Button>
      </div>
    </div>
  )
}

/** Hold-to-repeat without pairing with onClick (avoids double-fire on tap). */
function useRepeatPress(onStep: () => void) {
  const steppingRef = useRef(false)

  const start = (e: MouseEvent | TouchEvent) => {
    e.preventDefault()
    if (steppingRef.current) return
    steppingRef.current = true
    onStep()
    let delay = 300
    let timer: number | null = null
    const tick = () => {
      onStep()
      delay = Math.max(60, delay - 30)
      timer = window.setTimeout(tick, delay)
    }
    timer = window.setTimeout(tick, delay)
    const stop = () => {
      if (timer != null) window.clearTimeout(timer)
      timer = null
      steppingRef.current = false
    }
    window.addEventListener('mouseup', stop, { once: true })
    window.addEventListener('touchend', stop, { once: true })
    window.addEventListener('mouseleave', stop, { once: true })
    window.addEventListener('touchcancel', stop, { once: true })
  }

  return { onMouseDown: start, onTouchStart: start }
}

export default function MaxTest() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const isRetest = searchParams.get('retest') === '1'
  const [reps, setReps] = useState(0)
  const [warmup, setWarmup] = useState([false, false, false])
  const { settings, setSettings, setPendingTest, setTestDraft, clearTestDraft } = useAppStore()
  const navigate = useNavigate()
  const [showDisclaimer, setShowDisclaimer] = useState(!settings.healthDisclaimerAccepted)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [warmupError, setWarmupError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const hydratedRef = useRef(false)

  const warmupItems = program === 'pullups' ? pl.warmupItemsPullups : pl.warmupItemsPushups

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const draft = useAppStore.getState().testDraft
    if (draft?.program === program) {
      setReps(draft.reps)
      setWarmup(draft.warmup.length === 3 ? draft.warmup : [false, false, false])
    }
  }, [program])

  const minusPress = useRepeatPress(() => setReps((r) => Math.max(0, r - 1)))
  const plusPress = useRepeatPress(() => setReps((r) => Math.min(999, r + 1)))

  const acceptDisclaimer = () => {
    setSettings({ healthDisclaimerAccepted: true })
    setShowDisclaimer(false)
  }

  const warmupComplete = warmup.every(Boolean)

  const handleNext = async () => {
    if (submitLock.current || submitting) return
    if (!warmupComplete) {
      setWarmupError(true)
      return
    }
    setWarmupError(false)
    submitLock.current = true
    setSubmitting(true)

    try {
      const progress = await getProgramProgress(program)
      if (
        (isRetest || progress?.status === 'test_pending') &&
        progress?.nextWorkoutAfter &&
        !isWorkoutAvailable(new Date(progress.nextWorkoutAfter))
      ) {
        setBlocked(pl.testBlockedRest)
        return
      }

      const cycle = selectCycleByTest(program, reps)
      clearTestDraft()
      setPendingTest({ program, reps, cycleId: cycle.id })
      navigate(`/setup/cycle/${program}${isRetest ? '?retest=1' : ''}`)
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  const title = isRetest
    ? pl.retestAfterCycle(program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram)
    : program === 'pushups'
      ? pl.testPushups
      : pl.testPullups

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      {showDisclaimer && <HealthDisclaimer onAccept={acceptDisclaimer} />}

      {!isRetest && <SetupStepper current="test" />}

      <PageHeader
        title={title}
        subtitle={isRetest ? pl.retestSubtitle : pl.testPrompt}
      />

      {blocked && (
        <p className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-warning)]/15 p-3 text-sm text-[var(--sr-warning)]">
          {blocked}
        </p>
      )}

      {warmupError && !warmupComplete && (
        <p className="rounded-[var(--sr-radius-md)] bg-[var(--sr-error)]/10 p-3 text-sm text-[var(--sr-error)]">
          {pl.warmupRequired}
        </p>
      )}

      <div className="mt-2">
        <p className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.warmup}</p>
        <div className="mt-2 flex flex-col gap-1">
          {warmupItems.map((item, i) => (
            <label key={item} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0"
                checked={warmup[i]}
                onChange={() => {
                  setWarmup((w) => w.map((v, j) => (j === i ? !v : v)))
                  setWarmupError(false)
                }}
              />
              {item}
            </label>
          ))}
        </div>
      </div>

      {program === 'pullups' && (
        <p className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-info)]/10 p-3 text-sm text-[var(--sr-info)]">
          {pl.testPullupRules}
        </p>
      )}

      <div className="mt-8 flex flex-col items-center">
        <p className="tabular-nums text-5xl font-bold sm:text-6xl">{reps}</p>
        <p className="text-sm text-[var(--sr-text-muted)]">
          {program === 'pushups' ? pl.pushups : pl.pullups}
        </p>
        <div className="mt-4 flex gap-6">
          <button
            type="button"
            aria-label={pl.lessReps}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sr-bg-surface)] select-none"
            {...minusPress}
          >
            <Minus />
          </button>
          <button
            type="button"
            aria-label={pl.moreReps}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sr-bg-surface)] select-none"
            {...plusPress}
          >
            <Plus />
          </button>
        </div>
      </div>

      {program === 'pullups' && reps === 0 && (
        <Button
          variant="ghost"
          className="mt-4"
          fullWidth
          disabled={submitting}
          onClick={() => {
            setReps(0)
            void handleNext()
          }}
        >
          {pl.cantPullup}
        </Button>
      )}

      {program === 'pushups' && reps <= 2 && !isRetest && (
        <Button
          variant="ghost"
          className="mt-4"
          fullWidth
          onClick={() => {
            setTestDraft({ program, reps, warmup })
            navigate('/setup/technique?from=test')
          }}
        >
          {pl.howToPushup}
        </Button>
      )}

      <p className="mt-4 text-center text-xs text-[var(--sr-text-muted)]">{pl.testHonesty}</p>

      <Button className="mt-6" fullWidth disabled={submitting} onClick={() => void handleNext()}>
        {pl.nextPickCycle}
      </Button>
    </div>
  )
}
