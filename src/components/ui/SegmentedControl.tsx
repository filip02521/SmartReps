import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
  disabled = false,
  size = 'default',
  /** Equal-width segments — best for 2–3 primary choices on narrow screens. */
  stretch = false,
  /** Accessible name for the radiogroup. */
  'aria-label': ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
  disabled?: boolean
  size?: 'default' | 'compact'
  stretch?: boolean
  'aria-label'?: string
}) {
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])

  // ARIA radiogroup keyboard pattern: arrows/Home/End move selection,
  // only the checked radio is in the Tab order (roving tabindex).
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const idx = options.findIndex((o) => o.value === value)
    let next = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = (idx + 1) % options.length
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = (idx - 1 + options.length) % options.length
    } else if (e.key === 'Home') {
      next = 0
    } else if (e.key === 'End') {
      next = options.length - 1
    }
    if (next >= 0 && next !== idx) {
      e.preventDefault()
      onChange(options[next].value)
      btnRefs.current[next]?.focus()
    }
  }

  // Use radiogroup semantics — these are mutually exclusive choices (filters,
  // language selectors), not tab panels. Avoids implying tablist/tabpanel
  // relationships that don't exist here.
  return (
    <div
      className={cn(
        stretch ? 'flex gap-1.5' : 'flex flex-wrap gap-1.5',
        stretch && 'w-full',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
      role="radiogroup"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
    >
      {options.map((opt, i) => {
        const selected = value === opt.value
        // Fallback: when value matches no option, the first radio stays
        // in the Tab order so the group remains keyboard-reachable.
        const tabbable = selected || (!options.some((o) => o.value === value) && i === 0)
        return (
          <button
            key={opt.value}
            ref={(el) => {
              btnRefs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={disabled ? -1 : tabbable ? 0 : -1}
            disabled={disabled}
            className={cn(
              'rounded-[var(--sr-radius-full)] font-medium transition-all duration-150 active:scale-[0.97]',
              FOCUS_RING,
              stretch && 'min-w-0 flex-1',
              size === 'compact'
                ? 'min-h-12 px-2.5 py-2 text-xs'
                : 'min-h-12 px-4 py-2.5 text-sm',
              selected
                ? 'bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]'
                : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)] hover:text-[var(--sr-text-secondary)]',
            )}
            onClick={() => onChange(opt.value)}
          >
            <span className={cn(stretch && 'block truncate')}>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
