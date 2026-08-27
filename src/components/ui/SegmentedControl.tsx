import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)} role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          className={cn(
            'min-h-11 rounded-[var(--sr-radius-full)] px-4 py-2.5 text-sm font-medium transition-colors',
            FOCUS_RING,
            value === opt.value
              ? 'bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]'
              : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
          )}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
