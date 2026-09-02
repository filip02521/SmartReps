import { useEffect, useState } from 'react'
import {
  commitNumericDraft,
  formatNumericDisplay,
  normalizeNumericDraft,
  type NumericInputMode,
} from '@/lib/numeric-draft'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

/**
 * Clearable numeric field: empty while editing is allowed; commits on blur.
 * Decimal mode accepts `,` and `.` (displays with comma).
 */
export function NumericDraftInput({
  id,
  value,
  mode,
  min = 0,
  max,
  emptyValue,
  disabled,
  ariaLabel,
  className,
  inputClassName,
  onCommit,
}: {
  id?: string
  value: number
  mode: NumericInputMode
  min?: number
  max?: number
  /** Value used when the field is left empty (default: min). */
  emptyValue?: number
  disabled?: boolean
  ariaLabel: string
  className?: string
  inputClassName?: string
  onCommit: (value: number) => void
}) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(() => formatNumericDisplay(value, mode))

  useEffect(() => {
    if (!focused) setDraft(formatNumericDisplay(value, mode))
  }, [value, mode, focused])

  return (
    <input
      id={id}
      type="text"
      inputMode={mode === 'decimal' ? 'decimal' : 'numeric'}
      autoComplete="off"
      aria-label={ariaLabel}
      disabled={disabled}
      value={focused ? draft : formatNumericDisplay(value, mode)}
      onFocus={(e) => {
        setFocused(true)
        setDraft(formatNumericDisplay(value, mode))
        e.currentTarget.select()
      }}
      onChange={(e) => setDraft(normalizeNumericDraft(e.target.value, mode))}
      onBlur={() => {
        const next = commitNumericDraft(draft, mode, { min, max, emptyValue })
        onCommit(next)
        setDraft(formatNumericDisplay(next, mode))
        setFocused(false)
      }}
      className={cn(
        'w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-center text-lg font-semibold tabular-nums text-[var(--sr-text-primary)]',
        FOCUS_RING,
        disabled && 'opacity-60',
        className,
        inputClassName,
      )}
    />
  )
}
