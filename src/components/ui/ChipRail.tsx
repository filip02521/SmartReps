import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

/**
 * ChipRail — the shared single-select filter idiom: a horizontally scrollable
 * row of pill buttons with aria-pressed (community tag rail generalized).
 *
 * Use for list/scope filters (source, metric, range, tags). Keep
 * SegmentedControl for page navigation and grouped in-form choices — the two
 * idioms must stay visually distinct so filters don't look like tabs.
 */
export function ChipRail<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}) {
  return (
    <div
      className={cn(
        '-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            className={cn(
              FOCUS_RING,
              'shrink-0 rounded-[var(--sr-radius-full)] px-2.5 py-1.5 text-xs font-medium',
              active
                ? 'bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]'
                : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
            )}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
