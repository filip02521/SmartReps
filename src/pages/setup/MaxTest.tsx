import { useEffect, useMemo, useRef, useState, type MouseEvent, type TouchEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { CheckboxField } from '@/components/ui/TextField'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { selectCycleByTest } from '@/lib/cycle-selector'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import {
  techniqueLinkForProgram,
  techniqueLinkLabel,
} from '@/components/setup/TechniqueGuide'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn, vibrate } from '@/lib/utils'
import type { Program } from '@/data/plans/types'

export function HealthDisclaimer({
  onAccept,
  onDismiss,
}: {
  onAccept: () => void
  onDismiss: () => void
}) {
  const [checked, setChecked] = useState(false)

  return (
    <Sheet open onClose={onDismiss} title={pl.healthTitle} showClose>
      <p className="text-sm text-[var(--sr-text-secondary)]">{pl.healthDisclaimer}</p>
      <CheckboxField
        id="health-accept"
        className="mt-4"
        label={pl.healthAccept}
        checked={checked}
        onChange={setChecked}
      />
      <Button className="mt-6" size="touch" fullWidth disabled={!checked} onClick={onAccept}>
        {pl.confirm}
      </Button>
      <Button variant="ghost" className="mt-2" fullWidth onClick={onDismiss}>
        {pl.cancel}
      </Button>
    </Sheet>
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
  const { setSettings, setPendingTest, setTestDraft, clearTestDraft } = useAppStore()
  const navigate = useNavigate()
  const hydrated = useStoreHydrated()
  const [showDisclaimer, setShowDisclaimer] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [warmupError, setWarmupError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submitLock = useRef(false)
  const hydratedDraftRef = useRef(false)

  const warmupItems =
    program === 'pullups'
      ? pl.warmupItemsPullups
      : program === 'squats'
        ? pl.warmupItemsSquats
        : pl.warmupItemsPushups

  useEffect(() => {
    if (!hydrated || hydratedDraftRef.current) return
    hydratedDraftRef.current = true
    setShowDisclaimer(!useAppStore.getState().settings.healthDisclaimerAccepted)
    const draft = useAppStore.getState().testDraft
    if (draft?.program === program) {
      setReps(draft.reps)
      setWarmup(draft.warmup.length === 3 ? draft.warmup : [false, false, false])
    }
  }, [hydrated, program])

  const minusPress = useRepeatPress(() => { vibrate(8); setReps((r) => Math.max(0, r - 1)) })
  const plusPress = useRepeatPress(() => { vibrate(8); setReps((r) => Math.min(999, r + 1)) })

  const acceptDisclaimer = () => {
    setSettings({ healthDisclaimerAccepted: true })
    setShowDisclaimer(false)
  }

  const dismissDisclaimer = () => {
    setShowDisclaimer(false)
    navigate('/', { replace: true })
  }

  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const warmupComplete = warmup.every(Boolean)
  const warmupDone = warmup.filter(Boolean).length
  const recommendedCycle = useMemo(() => selectCycleByTest(program, reps), [program, reps])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

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
      // Gate retest, test_pending, and mid-cycle change-level when rest is active
      if (
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

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader />
      </div>
    )
  }

  const title = isRetest
    ? pl.retestAfterCycle(
        program === 'pushups'
          ? pl.pushupsProgram
          : program === 'pullups'
            ? pl.pullupsProgram
            : pl.squatsProgram,
      )
    : program === 'pushups'
      ? pl.testPushups
      : program === 'pullups'
        ? pl.testPullups
        : pl.testSquats

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      {showDisclaimer && (
        <HealthDisclaimer onAccept={acceptDisclaimer} onDismiss={dismissDisclaimer} />
      )}

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
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.warmup}</p>
          <span
            className={cn(
              'text-xs font-medium tabular-nums',
              warmupComplete ? 'text-[var(--sr-success)]' : 'text-[var(--sr-text-muted)]',
            )}
          >
            {pl.warmupProgress(warmupDone, warmupItems.length)}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-1">
          {warmupItems.map((item, i) => (
            <CheckboxField
              key={item}
              id={`warmup-${i}`}
              label={item}
              checked={warmup[i]}
              onChange={(checked) => {
                setWarmup((w) => w.map((v, j) => (j === i ? checked : v)))
                setWarmupError(false)
              }}
            />
          ))}
        </div>
      </div>

      {program === 'pullups' && (
        <p className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-info)]/10 p-3 text-sm text-[var(--sr-info)]">
          {pl.testPullupRules}
        </p>
      )}

      <div className="mt-4 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] p-3">
        <p className="text-sm text-[var(--sr-text-secondary)]">{pl.testHowTo}</p>
      </div>

      <div className="mt-8 flex flex-col items-center">
        {editing ? (
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={0}
            max={999}
            value={reps}
            aria-label={pl.testRepsLabel}
            onChange={(e) => {
              const v = e.target.value
              if (v === '') { setReps(0); return }
              const n = Math.max(0, Math.min(999, Number(v) || 0))
              setReps(n)
            }}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') setEditing(false) }}
            className="sr-text-display w-32 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] p-2 text-center tabular-nums outline-none ring-2 ring-[var(--sr-brand-primary)]"
          />
        ) : (
          <button
            type="button"
            aria-label={pl.testEditReps}
            onClick={() => { vibrate(8); setEditing(true) }}
            className="sr-text-display tabular-nums rounded-[var(--sr-radius-md)] px-2 py-1 transition-colors hover:bg-[var(--sr-bg-surface)] active:scale-95"
          >
            <span aria-live="polite" aria-atomic="true">{reps}</span>
          </button>
        )}
        <p className="text-sm text-[var(--sr-text-muted)]">
          {program === 'pushups' ? pl.pushups : program === 'pullups' ? pl.pullups : pl.squats}
        </p>
        <div className="mt-4 flex gap-6">
          <button
            type="button"
            aria-label={pl.lessReps}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] select-none transition-colors hover:bg-[var(--sr-bg-elevated)] active:scale-95',
              FOCUS_RING,
            )}
            {...minusPress}
          >
            <Minus aria-hidden />
          </button>
          <button
            type="button"
            aria-label={pl.moreReps}
            className={cn(
              'flex h-14 w-14 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] select-none transition-colors hover:bg-[var(--sr-bg-elevated)] active:scale-95',
              FOCUS_RING,
            )}
            {...plusPress}
          >
            <Plus aria-hidden />
          </button>
        </div>
      </div>

      {/* Live cycle preview — updates as user adjusts reps */}
      <div
        className="mt-4 flex items-center justify-center gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary-muted)] bg-[var(--sr-brand-primary-muted)]/50 p-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <Check size={16} className="text-[var(--sr-brand-primary)]" aria-hidden />
        <p className="text-sm font-medium text-[var(--sr-text-primary)]">
          {pl.testRecommendedCycle(recommendedCycle.nameShort)}
        </p>
      </div>

      {program === 'pullups' && reps === 0 && (
        <Button
          variant="ghost"
          className="mt-4"
          fullWidth
          disabled={submitting}
          onClick={() => void handleNext()}
        >
          {pl.cantPullup}
        </Button>
      )}

      {(program === 'pushups' && reps <= 2 && !isRetest) ||
      (program === 'pullups' && reps <= 2) ? (
        <Button
          variant="ghost"
          className="mt-4"
          fullWidth
          onClick={() => {
            setTestDraft({ program, reps, warmup })
            navigate(techniqueLinkForProgram(program, 'test'))
          }}
        >
          {techniqueLinkLabel(program)}
        </Button>
      ) : null}

      <p className="mt-4 text-center text-xs text-[var(--sr-text-muted)]">{pl.testHonesty}</p>

      <Button className="mt-6" fullWidth disabled={submitting} onClick={() => void handleNext()}>
        {pl.testNextWithCycle(recommendedCycle.nameShort)}
      </Button>
    </div>
  )
}
