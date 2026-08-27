import { cn, formatRestTime, vibrate } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import { Check, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getSetLabel, getTargetReps, formatSetTarget } from '@/lib/progress-engine'
import type { SetTarget } from '@/data/plans/types'
import type { Program } from '@/data/plans/types'
import { useState } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { PreviousResultBadge } from '@/components/workout/PreviousResultBadge'

export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[var(--sr-bg-overlay)] safe-bottom">
      <div className="w-full max-w-lg rounded-t-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] p-6">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <Button fullWidth onClick={onConfirm}>{confirmLabel ?? pl.confirm}</Button>
          <Button variant="ghost" fullWidth onClick={onCancel}>{cancelLabel ?? pl.cancel}</Button>
        </div>
      </div>
    </div>
  )
}

export function RepCounter({
  target,
  program,
  actual,
  onActualChange,
  onDone,
  lastActual,
  pulseFlash,
}: {
  target: SetTarget
  program: Program
  actual: number
  onActualChange: (n: number) => void
  onDone: () => void
  lastActual?: number
  pulseFlash?: boolean
}) {
  const targetReps = getTargetReps(target)

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <p className="sr-text-overline text-[var(--sr-text-muted)]">
        {getSetLabel(target, program)}
      </p>
      <p
        className={cn(
          'sr-text-display tabular-nums leading-none text-[var(--sr-text-primary)]',
          pulseFlash && 'animate-pulse-success',
        )}
      >
        {actual}
      </p>
      {lastActual !== undefined && (
        <PreviousResultBadge actual={lastActual} target={targetReps} />
      )}
      <div className="flex w-full max-w-xs items-center gap-3">
        <button
          type="button"
          aria-label="Mniej"
          className="flex h-14 w-14 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-primary)]"
          onClick={() => onActualChange(Math.max(0, actual - 1))}
        >
          <Minus size={24} />
        </button>
        <Button size="touch" fullWidth onClick={onDone}>
          {pl.done}
        </Button>
        <button
          type="button"
          aria-label="Więcej"
          className="flex h-14 w-14 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-primary)]"
          onClick={() => onActualChange(actual + 1)}
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  )
}

function SetStatusIcon({ state }: { state: 'pending' | 'active' | 'done' | 'failed' }) {
  if (state === 'done') return <Check size={16} className="text-[var(--sr-success)]" />
  if (state === 'failed') return <X size={16} className="text-[var(--sr-error)]" />
  if (state === 'active') return <ChevronRight size={16} className="text-[var(--sr-brand-primary)]" />
  return <span className="inline-block h-4 w-4" />
}

export function SetRow({
  setNumber,
  target,
  state,
  actual,
  onClick,
}: {
  setNumber: number
  target: SetTarget
  state: 'pending' | 'active' | 'done' | 'failed'
  actual?: number
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'done'}
      data-active-set={state === 'active' ? 'true' : undefined}
      className={cn(
        'flex w-full items-center justify-between rounded-[var(--sr-radius-md)] px-4 py-3 text-left transition-colors',
        state === 'active' && 'border-2 border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]',
        state === 'done' && 'bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
        state === 'failed' && 'bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
        state === 'pending' && 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
      )}
    >
      <span className="flex items-center gap-2 font-medium">
        <SetStatusIcon state={state} />
        Seria {setNumber}
      </span>
      <span className="tabular-nums text-sm">
        {state === 'done' && actual !== undefined
          ? `${actual} / ${formatSetTarget(target)}`
          : `cel ${formatSetTarget(target)}`}
      </span>
    </button>
  )
}

export function SetChecklist({
  sets,
  currentIndex,
  results,
  failedIndex,
  dimmed,
}: {
  sets: SetTarget[]
  currentIndex: number
  results: { setNumber: number; actual: number; passed: boolean }[]
  failedIndex?: number
  dimmed?: boolean
}) {
  return (
    <div className={cn('flex flex-col gap-2 overflow-y-auto transition-opacity', dimmed && 'opacity-40')}>
      {sets.map((target, i) => {
        const setNumber = i + 1
        const result = results.find((r) => r.setNumber === setNumber)
        let state: 'pending' | 'active' | 'done' | 'failed' = 'pending'
        if (result?.passed) state = 'done'
        else if (failedIndex === i) state = 'failed'
        else if (i === currentIndex) state = 'active'
        return (
          <SetRow
            key={setNumber}
            setNumber={setNumber}
            target={target}
            state={state}
            actual={result?.actual}
          />
        )
      })}
    </div>
  )
}

export function NegativeBanner() {
  return (
    <div className="sticky top-0 z-10 rounded-[var(--sr-radius-md)] border border-[var(--sr-pullups-accent)] bg-[rgba(167,139,250,0.15)] px-4 py-2 text-sm text-[var(--sr-pullups-accent)]">
      Opuszczaj powoli (3–5 s). Liczy się pełna kontrola ruchu.
    </div>
  )
}

export function NegativeCountdown({ seconds }: { seconds: number }) {
  return (
    <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-pullups-accent)]/15 px-4 py-2 text-center text-sm font-medium text-[var(--sr-pullups-accent)]">
      {pl.negativeCountdown(seconds)}
    </div>
  )
}

export function RestTimerPill({
  remainingSec,
  onExpand,
  onAdd15,
}: {
  remainingSec: number
  onExpand: () => void
  onAdd15?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onExpand}
        aria-live="polite"
        className="flex flex-1 items-center justify-between rounded-[var(--sr-radius-full)] bg-[var(--sr-bg-elevated)] px-5 py-3 shadow-[var(--sr-shadow-glow)]"
      >
        <span className="text-sm text-[var(--sr-text-secondary)]">{pl.restLabel}</span>
        <span className="tabular-nums text-xl font-bold text-[var(--sr-brand-secondary)]">
          {formatRestTime(remainingSec)}
        </span>
        <ChevronRight size={18} className="text-[var(--sr-text-muted)] rotate-[-90deg]" />
      </button>
      {onAdd15 && (
        <Button variant="secondary" size="sm" className="shrink-0" onClick={onAdd15}>
          {pl.add15s}
        </Button>
      )}
    </div>
  )
}

export function RestTimerExpanded({
  remainingSec,
  totalSec,
  nextLabel,
  onAdd15,
  onAdd30,
  onSkip,
  onCollapse,
}: {
  remainingSec: number
  totalSec: number
  nextLabel: string
  onAdd15: () => void
  onAdd30: () => void
  onSkip: () => void
  onCollapse: () => void
}) {
  const [showSkipConfirm, setShowSkipConfirm] = useState(false)
  const trapRef = useFocusTrap(true)
  const progress = totalSec > 0 ? (totalSec - remainingSec) / totalSec : 0
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <div
      ref={trapRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--sr-bg-overlay)] safe-top safe-bottom"
      role="dialog"
      aria-modal="true"
      aria-label="Timer przerwy"
      onKeyDown={(e) => { if (e.key === 'Escape') onCollapse() }}
    >
      <button
        type="button"
        className="absolute right-4 top-4 text-[var(--sr-text-secondary)]"
        onClick={onCollapse}
      >
        {pl.collapseTimer}
      </button>
      <p className="mb-4 sr-text-overline text-[var(--sr-text-muted)]">
        {pl.restLabel}
      </p>
      <ProgressRing progress={progress} size={220} reducedMotion={reducedMotion}>
        <span
          className="tabular-nums text-5xl font-bold text-[var(--sr-brand-secondary)]"
          aria-live="polite"
        >
          {formatRestTime(remainingSec)}
        </span>
      </ProgressRing>
      <p className="mt-6 text-sm text-[var(--sr-text-secondary)]">{nextLabel}</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3 px-4">
        <Button variant="secondary" size="sm" onClick={onAdd15}>{pl.add15s}</Button>
        <Button variant="secondary" size="sm" onClick={onAdd30}>{pl.add30s}</Button>
        <Button variant="ghost" size="sm" onClick={() => setShowSkipConfirm(true)}>{pl.skipRest}</Button>
      </div>
      {showSkipConfirm && (
        <ConfirmSheet
          title={pl.skipRest}
          message={pl.skipRestConfirm}
          confirmLabel={pl.skipRest}
          onConfirm={() => { setShowSkipConfirm(false); onSkip() }}
          onCancel={() => setShowSkipConfirm(false)}
        />
      )}
    </div>
  )
}

export function DayPlanSheet({
  sets,
  restSec,
  onClose,
}: {
  sets: SetTarget[]
  restSec: number
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[55] flex items-end bg-[var(--sr-bg-overlay)] safe-bottom">
      <div className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{pl.previewDayPlan}</h3>
          <button type="button" onClick={onClose} className="text-[var(--sr-text-muted)]">{pl.close}</button>
        </div>
        <p className="mb-3 text-sm text-[var(--sr-text-secondary)]">Przerwa między seriami: {restSec}s</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--sr-text-muted)]">
              <th className="pb-2">Seria</th>
              <th className="pb-2">Cel</th>
            </tr>
          </thead>
          <tbody>
            {sets.map((s, i) => (
              <tr key={i} className="border-t border-[var(--sr-border-subtle)]">
                <td className="py-2">{i + 1}</td>
                <td className="py-2">{formatSetTarget(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function onSetComplete() {
  vibrate(50)
}

export function onSetFailed() {
  vibrate([100, 50, 100])
}

export function CycleCelebration({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[var(--sr-bg-overlay)] p-6 text-center safe-top safe-bottom overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className="absolute h-2 w-2 rounded-full opacity-80"
            style={{
              left: `${(i * 17) % 100}%`,
              top: `${(i * 23) % 60}%`,
              background: i % 2 ? 'var(--sr-brand-primary)' : 'var(--sr-brand-secondary)',
              animation: `sr-confetti ${1 + (i % 5) * 0.2}s ease-out forwards`,
              animationDelay: `${(i % 8) * 0.05}s`,
            }}
          />
        ))}
      </div>
      <div className="relative max-w-sm rounded-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] p-8">
        <p className="sr-gradient-text text-2xl font-bold">{pl.goalAchieved}</p>
        <p className="mt-3 text-[var(--sr-text-secondary)]">{message}</p>
        <Button className="mt-6" fullWidth onClick={onDismiss}>{pl.continueSetup}</Button>
      </div>
    </div>
  )
}
