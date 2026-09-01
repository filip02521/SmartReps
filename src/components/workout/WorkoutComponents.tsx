import { cn, formatRestTime } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import { Check, ChevronRight, Minus, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { OverlayPortal } from '@/components/ui/OverlayPortal'
import { Sheet } from '@/components/ui/Sheet'
import { getSetLabel, getTargetReps, formatSetTarget } from '@/lib/progress-engine'
import type { SetTarget } from '@/data/plans/types'
import type { Program } from '@/data/plans/types'
import { useState, type ReactNode } from 'react'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { PreviousResultBadge } from '@/components/workout/PreviousResultBadge'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { Z_REST_EXPANDED, Z_CELEBRATION } from '@/lib/ui-chrome'

export function ConfirmSheet({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  variant = 'primary',
  extraActions,
}: {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  variant?: 'primary' | 'danger'
  /** Optional middle actions (e.g. logout keep-data) between confirm and cancel. */
  extraActions?: ReactNode
}) {
  return (
    <Sheet open onClose={onCancel} title={title} showClose={false} elevated>
      <p className="text-sm text-[var(--sr-text-secondary)]">{message}</p>
      <div className="mt-6 flex flex-col gap-2">
        <Button
          fullWidth
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
        >
          {confirmLabel ?? pl.confirm}
        </Button>
        {extraActions}
        <Button variant="ghost" fullWidth onClick={onCancel}>
          {cancelLabel ?? pl.cancel}
        </Button>
      </div>
    </Sheet>
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
  disabled,
  disabledHint,
  onDisabledTap,
}: {
  target: SetTarget
  program: Program
  actual: number
  onActualChange: (n: number) => void
  onDone: () => void
  lastActual?: number
  pulseFlash?: boolean
  disabled?: boolean
  disabledHint?: string
  onDisabledTap?: () => void
}) {
  const targetReps = getTargetReps(target)
  const isExact = target.kind === 'exact'
  const maxReps = isExact ? targetReps : 999

  return (
    <div className={cn('flex flex-col items-center gap-4 py-4', disabled && 'opacity-60')}>
      <p className="sr-text-overline text-[var(--sr-text-muted)]">
        {getSetLabel(target, program)}
      </p>
      {isExact && (
        <p className="text-center text-sm text-[var(--sr-text-secondary)]">
          {pl.exactLiveHint(targetReps)}
        </p>
      )}
      <p
        className={cn(
          'sr-text-display tabular-nums leading-none text-[var(--sr-text-primary)]',
          pulseFlash && 'animate-pulse-success',
          isExact && actual !== targetReps && actual > 0 && 'text-[var(--sr-warning)]',
        )}
      >
        {actual}
      </p>
      {lastActual !== undefined && (
        <PreviousResultBadge actual={lastActual} target={targetReps} />
      )}
      {disabled && disabledHint && (
        <p className="text-center text-sm text-[var(--sr-text-secondary)]">{disabledHint}</p>
      )}
      <div className="flex w-full max-w-xs items-center gap-3">
        <button
          type="button"
          aria-label={pl.lessReps}
          disabled={disabled}
          className="flex h-14 w-14 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-primary)] disabled:opacity-50"
          onClick={() => onActualChange(Math.max(0, actual - 1))}
        >
          <Minus size={24} />
        </button>
        <Button
          size="touch"
          fullWidth
          disabled={disabled && !onDisabledTap}
          onClick={() => {
            if (disabled) {
              onDisabledTap?.()
              return
            }
            onDone()
          }}
        >
          {pl.done}
        </Button>
        <button
          type="button"
          aria-label={pl.moreReps}
          disabled={disabled || actual >= maxReps}
          className="flex h-14 w-14 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-primary)] disabled:opacity-50"
          onClick={() => onActualChange(Math.min(maxReps, actual + 1))}
        >
          <Plus size={24} />
        </button>
      </div>
    </div>
  )
}

function SetStatusIcon({ state }: { state: 'pending' | 'active' | 'done' | 'failed' }) {
  if (state === 'done') return <Check size={16} className="text-[var(--sr-success)] animate-check-in" />
  if (state === 'failed') return <X size={16} className="text-[var(--sr-error)]" />
  if (state === 'active') return <ChevronRight size={16} className="text-[var(--sr-brand-primary)]" />
  return <span className="inline-block h-4 w-4" />
}

export function SetRow({
  setNumber,
  target,
  state,
  actual,
  editable,
  onClick,
}: {
  setNumber: number
  target: SetTarget
  state: 'pending' | 'active' | 'done' | 'failed'
  actual?: number
  /** Last completed set can be tapped to correct reps. */
  editable?: boolean
  onClick?: () => void
}) {
  const canPress = Boolean(onClick) && (state !== 'done' || editable)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canPress}
      data-active-set={state === 'active' ? 'true' : undefined}
      aria-label={
        editable
          ? `${pl.setColumn} ${setNumber} — ${pl.editPreviousSet}`
          : undefined
      }
      className={cn(
        'flex w-full items-center justify-between rounded-[var(--sr-radius-md)] px-4 py-3.5 text-left transition-colors',
        state === 'active' && 'border-2 border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]',
        state === 'done' && 'bg-[var(--sr-success-muted)]',
        state === 'failed' && 'bg-[var(--sr-error-muted)]',
        state === 'pending' && 'bg-[var(--sr-bg-surface)]',
        editable && 'ring-1 ring-[var(--sr-brand-primary)]/40',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-2 font-medium',
          state === 'done' && 'text-[var(--sr-success)]',
          state === 'failed' && 'text-[var(--sr-error)]',
          state === 'pending' && 'text-[var(--sr-text-secondary)]',
          state === 'active' && 'text-[var(--sr-text-primary)]',
        )}
      >
        <SetStatusIcon state={state} />
        {pl.setColumn} {setNumber}
      </span>
      <span
        className={cn(
          'tabular-nums text-base font-semibold',
          state === 'done' && 'text-[var(--sr-text-primary)]',
          state === 'failed' && 'text-[var(--sr-error)]',
          state === 'pending' && 'text-[var(--sr-text-primary)]',
          state === 'active' && 'text-[var(--sr-text-primary)]',
        )}
      >
        {state === 'done' && actual !== undefined
          ? editable
            ? `${actual} / ${formatSetTarget(target)} · ${pl.editShort}`
            : `${actual} / ${formatSetTarget(target)}`
          : formatSetTarget(target)}
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
  onEditLastSet,
}: {
  sets: SetTarget[]
  currentIndex: number
  results: { setNumber: number; actual: number; passed: boolean }[]
  failedIndex?: number
  dimmed?: boolean
  onEditLastSet?: () => void
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
        // After completing set N, currentIndex === N; that done row is editable.
        const editable = state === 'done' && setNumber === currentIndex && Boolean(onEditLastSet)
        return (
          <SetRow
            key={setNumber}
            setNumber={setNumber}
            target={target}
            state={state}
            actual={result?.actual}
            editable={editable}
            onClick={editable ? onEditLastSet : undefined}
          />
        )
      })}
    </div>
  )
}

export function NegativeBanner() {
  return (
    <div className="sticky top-0 z-10 rounded-[var(--sr-radius-md)] border border-[var(--sr-pullups-accent)] bg-[rgba(167,139,250,0.15)] px-4 py-2 text-sm text-[var(--sr-pullups-accent)]">
      {pl.negativeBanner}
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
    <div className="flex items-center gap-2 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-2 shadow-[var(--sr-shadow-card)]">
      <button
        type="button"
        onClick={onExpand}
        aria-live="polite"
        className="flex min-h-12 flex-1 items-center justify-between rounded-[var(--sr-radius-full)] bg-[var(--sr-brand-primary-muted)] px-5 py-3"
      >
        <span className="text-sm font-medium text-[var(--sr-text-secondary)]">{pl.restLabel}</span>
        <span className="tabular-nums text-2xl font-bold text-[var(--sr-text-primary)]">
          {formatRestTime(remainingSec)}
        </span>
        <ChevronRight size={18} className="text-[var(--sr-text-muted)] rotate-[-90deg]" />
      </button>
      {onAdd15 && (
        <Button variant="secondary" size="sm" className="min-h-12 shrink-0" onClick={onAdd15}>
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
  const safeTotal = totalSec > 0 ? totalSec : 1
  const progress = Math.min(1, Math.max(0, (safeTotal - remainingSec) / safeTotal))
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return (
    <OverlayPortal>
      <div
        ref={trapRef}
        className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--sr-bg-overlay)] text-[var(--sr-text-primary)] safe-top safe-bottom"
        style={{ zIndex: Z_REST_EXPANDED }}
        role="dialog"
        aria-modal="true"
        aria-label={pl.restLabel}
        onKeyDown={(e) => { if (e.key === 'Escape') onCollapse() }}
      >
      <button
        type="button"
        className="absolute right-4 top-4 min-h-11 min-w-11 rounded-[var(--sr-radius-md)] px-3 text-sm text-[var(--sr-text-secondary)]"
        onClick={onCollapse}
      >
        {pl.collapseTimer}
      </button>
      <p className="mb-4 sr-text-overline text-[var(--sr-text-muted)]">
        {pl.restLabel}
      </p>
      <ProgressRing progress={progress} size={220} reducedMotion={reducedMotion}>
        <span
          className="tabular-nums text-5xl font-bold text-[var(--sr-text-primary)]"
          aria-live="polite"
        >
          {formatRestTime(remainingSec)}
        </span>
      </ProgressRing>
      {nextLabel ? (
        <p className="mt-6 px-4 text-center text-sm text-[var(--sr-text-secondary)]">{nextLabel}</p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3 px-4">
        <Button variant="secondary" size="sm" className="min-h-11" onClick={onAdd15}>{pl.add15s}</Button>
        <Button variant="secondary" size="sm" className="min-h-11" onClick={onAdd30}>{pl.add30s}</Button>
        <Button variant="ghost" size="sm" className="min-h-11" onClick={() => setShowSkipConfirm(true)}>{pl.skipRest}</Button>
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
    </OverlayPortal>
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
    <Sheet open onClose={onClose} title={pl.previewDayPlan}>
      <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
        {pl.restBetweenSets(restSec)}
      </p>
      <SetTargetsRow sets={sets} size="md" />
    </Sheet>
  )
}

export {
  onSetCompleteFeedback as onSetComplete,
  onSetFailedFeedback as onSetFailed,
  initWorkoutAudio,
} from '@/lib/workout-feedback'

export function CycleCelebration({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--sr-bg-overlay)] p-6 text-center safe-top safe-bottom overflow-hidden"
        style={{ zIndex: Z_CELEBRATION }}
      >      <div className="pointer-events-none absolute inset-0">
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
    </OverlayPortal>
  )
}
