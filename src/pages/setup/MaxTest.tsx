import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { selectCycleByTest } from '@/lib/cycle-selector'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'

export function HealthDisclaimer({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sr-bg-overlay)] p-4">
      <div className="max-w-sm rounded-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] p-6">
        <h2 className="text-lg font-semibold">Zdrowie i bezpieczeństwo</h2>
        <p className="mt-3 text-sm text-[var(--sr-text-secondary)]">{pl.healthDisclaimer}</p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
          {pl.healthAccept}
        </label>
        <Button className="mt-6" fullWidth disabled={!checked} onClick={onAccept}>{pl.confirm}</Button>
      </div>
    </div>
  )
}

function useRepeatPress(onStep: () => void) {
  const start = () => {
    onStep()
    let delay = 300
    let interval = window.setInterval(() => {
      onStep()
      delay = Math.max(60, delay - 30)
    }, delay)
    const stop = () => clearInterval(interval)
    window.addEventListener('mouseup', stop, { once: true })
    window.addEventListener('touchend', stop, { once: true })
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
  const { settings, setSettings, setPendingTest } = useAppStore()
  const navigate = useNavigate()
  const [showDisclaimer, setShowDisclaimer] = useState(!settings.healthDisclaimerAccepted)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [warmupHint, setWarmupHint] = useState(false)

  const minusPress = useRepeatPress(() => setReps((r) => Math.max(0, r - 1)))
  const plusPress = useRepeatPress(() => setReps((r) => Math.min(999, r + 1)))

  const acceptDisclaimer = () => {
    setSettings({ healthDisclaimerAccepted: true })
    setShowDisclaimer(false)
  }

  const warmupComplete = warmup.every(Boolean)

  const handleNext = async () => {
    if (!warmupComplete) {
      setWarmupHint(true)
    }

    const progress = await getProgramProgress(program)
    if (progress?.nextWorkoutAfter && !isWorkoutAvailable(new Date(progress.nextWorkoutAfter))) {
      setBlocked(pl.testBlockedRest)
      return
    }

    const cycle = selectCycleByTest(program, reps)
    setPendingTest({ program, reps, cycleId: cycle.id })
    navigate(`/setup/cycle/${program}${isRetest ? '?retest=1' : ''}`)
  }

  const title = isRetest
    ? `Test po cyklu — ${program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram}`
    : program === 'pushups'
      ? pl.testPushups
      : pl.testPullups

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      {showDisclaimer && <HealthDisclaimer onAccept={acceptDisclaimer} />}

      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">
        {isRetest ? 'Sprawdź postęp i wybierz kolejny cykl po teście.' : pl.testPrompt}
      </p>

      {blocked && (
        <p className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-warning)]/15 p-3 text-sm text-[var(--sr-warning)]">
          {blocked}
        </p>
      )}

      {warmupHint && !warmupComplete && (
        <p className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-info)]/10 p-3 text-sm text-[var(--sr-info)]">
          {pl.warmupRecommended}
        </p>
      )}

      <div className="mt-6">
        <p className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.warmup}</p>
        <div className="mt-2 flex flex-col gap-2">
          {pl.warmupItems.map((item, i) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={warmup[i]}
                onChange={() => setWarmup((w) => w.map((v, j) => (j === i ? !v : v)))}
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
        <p className="tabular-nums text-6xl font-bold">{reps}</p>
        <p className="text-sm text-[var(--sr-text-muted)]">
          {program === 'pushups' ? pl.pushups : pl.pullups}
        </p>
        <div className="mt-4 flex gap-6">
          <button
            type="button"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sr-bg-surface)]"
            onClick={() => setReps(Math.max(0, reps - 1))}
            {...minusPress}
          >
            <Minus />
          </button>
          <button
            type="button"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sr-bg-surface)]"
            onClick={() => setReps(reps + 1)}
            {...plusPress}
          >
            <Plus />
          </button>
        </div>
      </div>

      {program === 'pullups' && reps === 0 && (
        <Button variant="ghost" className="mt-4" fullWidth onClick={() => { setReps(0); void handleNext() }}>
          {pl.cantPullup}
        </Button>
      )}

      {program === 'pushups' && reps <= 2 && !isRetest && (
        <Button variant="ghost" className="mt-4" fullWidth onClick={() => navigate('/setup/technique')}>
          Jak robić pompkę?
        </Button>
      )}

      <p className="mt-4 text-center text-xs text-[var(--sr-text-muted)]">{pl.testHonesty}</p>

      <Button className="mt-6" fullWidth onClick={() => void handleNext()}>
        {pl.nextPickCycle}
      </Button>
    </div>
  )
}
