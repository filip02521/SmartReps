import { TrendingUp, Minus, ArrowDown, Info } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import type { ProgressionSuggestion } from '@/lib/rpe-analysis'

/**
 * Post-workout progression suggestion panel.
 * Shows RPE/RIR-based recommendation for the next session.
 *
 * Builtin workouts: info-only (cannot modify fixed plans).
 * Custom workouts: "Apply" button modifies the next session's targets.
 */
export function ProgressionSuggestionPanel({
  suggestion,
  onApply,
  onDismiss,
  canApply = false,
}: {
  suggestion: ProgressionSuggestion
  onApply?: () => void
  onDismiss?: () => void
  /** When true, show "Apply" button. When false, show "Info" badge only. */
  canApply?: boolean
}) {
  const reasonText = resolveReason(suggestion)

  const icon =
    suggestion.kind === 'increase_reps' || suggestion.kind === 'increase_weight'
      ? TrendingUp
      : suggestion.kind === 'maintain'
        ? Minus
        : suggestion.kind === 'reduce_volume' || suggestion.kind === 'deload'
          ? ArrowDown
          : Info

  const Icon = icon
  const tone =
    suggestion.kind === 'increase_reps' || suggestion.kind === 'increase_weight'
      ? 'success'
      : suggestion.kind === 'maintain'
        ? 'neutral'
        : suggestion.kind === 'reduce_volume'
          ? 'warning'
          : suggestion.kind === 'deload'
            ? 'error'
            : 'neutral'

  const toneClasses = {
    success: 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
    neutral: 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] text-[var(--sr-text-secondary)]',
    warning: 'border-[var(--sr-warning)]/30 bg-[var(--sr-warning-muted)] text-[var(--sr-warning)]',
    error: 'border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
  } as const

  return (
    <div
      className={cn(
        'mt-4 rounded-[var(--sr-radius-md)] border p-4',
        toneClasses[tone],
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)]" aria-hidden>
          <Icon size={18} strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {pl.progressionSuggestionTitle}
          </p>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{reasonText}</p>
          {(suggestion.avgRpe != null || suggestion.avgRir != null) && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {suggestion.avgRpe != null && (
                <span className="inline-flex items-center rounded-full bg-[var(--sr-brand-primary-muted)] px-2 py-0.5 font-semibold tabular-nums text-[var(--sr-brand-primary)]">
                  {pl.progressionSuggestionAvgRpe}: {suggestion.avgRpe}
                </span>
              )}
              {suggestion.avgRir != null && (
                <span className="inline-flex items-center rounded-full bg-[var(--sr-bg-surface)] px-2 py-0.5 font-semibold tabular-nums text-[var(--sr-text-muted)]">
                  {pl.progressionSuggestionAvgRir}: {suggestion.avgRir}
                </span>
              )}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {canApply && onApply && (
              <button
                type="button"
                onClick={onApply}
                className="rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary)] px-3 py-1.5 sr-text-body-sm font-semibold text-white transition-colors hover:brightness-110 active:scale-[0.98]"
              >
                {pl.progressionSuggestionApply}
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] px-3 py-1.5 sr-text-body-sm font-medium text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)]"
              >
                {pl.progressionSuggestionDismiss}
              </button>
            )}
            {!canApply && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--sr-text-muted)]">
                <Info size={12} aria-hidden />
                {pl.progressionSuggestionInfoOnly}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function resolveReason(s: ProgressionSuggestion): string {
  const key = s.reasonKey as keyof typeof pl
  const fn = pl[key] as unknown as ((...args: (string | number)[]) => string) | undefined
  if (typeof fn === 'function') {
    return fn(...(s.reasonParams ?? []))
  }
  if (typeof fn === 'string') {
    return fn
  }
  // Fallback: never show raw key to user
  return pl.progressionSuggestionInfoOnly
}
