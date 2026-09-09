import { useState, useEffect } from 'react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { RPE_VALUES, RIR_VALUES } from '@/lib/exercise-model'

type Mode = 'rpe' | 'rir'

export function RpeRirPicker({
  value,
  mode,
  onChange,
  onModeChange,
}: {
  value: number | null
  mode: Mode
  onChange: (v: number | null) => void
  onModeChange: (m: Mode) => void
}) {
  const [expanded, setExpanded] = useState(value !== null)

  // Auto-expand when value is restored externally (e.g., undo) — null → non-null transition
  useEffect(() => {
    if (value !== null) setExpanded(true)
  }, [value])

  const values = mode === 'rpe' ? RPE_VALUES : RIR_VALUES
  const label = mode === 'rpe' ? pl.rpeLabel : pl.rirLabel
  const hint = mode === 'rpe' ? pl.rpeHint : pl.rirHint
  const description =
    value != null
      ? mode === 'rpe'
        ? pl.rpeDescription(value)
        : pl.rirDescription(value)
      : null

  return (
    <div className="mt-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-2.5">
      {/* Header row: toggle + mode switch */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 sr-text-body-sm font-medium text-[var(--sr-text-secondary)] transition-colors',
            FOCUS_RING,
          )}
          aria-expanded={expanded}
          aria-label={expanded ? pl.rpeRirToggle : `${label} ${value ?? ''}`.trim()}
        >
          <span
            className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold transition-colors',
              value != null
                ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary)] text-white'
                : 'border-[var(--sr-border-strong)] text-[var(--sr-text-muted)]',
            )}
          >
            {value ?? '–'}
          </span>
          {label}
        </button>

        {expanded && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onModeChange('rpe')}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                mode === 'rpe'
                  ? 'bg-[var(--sr-brand-primary)] text-white'
                  : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
                FOCUS_RING,
              )}
            >
              {pl.rpeRirModeRpe}
            </button>
            <button
              type="button"
              onClick={() => onModeChange('rir')}
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
                mode === 'rir'
                  ? 'bg-[var(--sr-brand-primary)] text-white'
                  : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
                FOCUS_RING,
              )}
            >
              {pl.rpeRirModeRir}
            </button>
            {value != null && (
              <button
                type="button"
                onClick={() => onChange(null)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium text-[var(--sr-text-muted)] transition-colors hover:text-[var(--sr-text-secondary)]',
                  FOCUS_RING,
                )}
                aria-label={pl.rpeRirClear}
              >
                {pl.rpeRirClear}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Expanded: value chips */}
      {expanded && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs text-[var(--sr-text-muted)]">{hint}</p>
          <div className="flex flex-wrap gap-1">
            {values.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onChange(v === value ? null : v)}
                className={cn(
                  'h-8 w-8 rounded-full text-xs font-bold transition-all active:scale-90',
                  value === v
                    ? 'bg-[var(--sr-brand-primary)] text-white ring-2 ring-[var(--sr-brand-primary)]/30'
                    : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)] hover:bg-[var(--sr-bg-elevated)]',
                  FOCUS_RING,
                )}
                aria-label={`${label} ${v}`}
                aria-pressed={value === v}
              >
                {v}
              </button>
            ))}
          </div>
          {description && (
            <p className="mt-1.5 text-xs text-[var(--sr-text-muted)]">{description}</p>
          )}
        </div>
      )}
    </div>
  )
}
