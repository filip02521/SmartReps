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
  /** Accessible name for the tablist. */
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
  return (
    <div
      className={cn(
        stretch ? 'flex gap-1.5' : 'flex flex-wrap gap-1.5',
        stretch && 'w-full',
        disabled && 'pointer-events-none opacity-60',
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          disabled={disabled}
          className={cn(
            'rounded-[var(--sr-radius-full)] font-medium transition-colors',
            FOCUS_RING,
            stretch && 'min-w-0 flex-1',
            size === 'compact'
              ? 'min-h-9 px-2.5 py-1.5 text-xs'
              : 'min-h-11 px-4 py-2.5 text-sm',
            value === opt.value
              ? 'bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]'
              : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
          )}
          onClick={() => onChange(opt.value)}
        >
          <span className={cn(stretch && 'block truncate')}>{opt.label}</span>
        </button>
      ))}
    </div>
  )
}
