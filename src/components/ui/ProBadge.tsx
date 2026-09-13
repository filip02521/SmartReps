import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'

/**
 * "PRO" badge — marks Pro-only features in the UI.
 * Uses brand gradient to stand out from regular badges.
 *
 * Shown next to Pro-gated features; the surrounding control opens ProTeaser.
 */
export function ProBadge({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-[var(--sr-radius-full)] bg-[var(--sr-brand-primary-muted)] px-2 py-0.5 font-bold uppercase tracking-wide text-[var(--sr-brand-primary-hover)]',
        size === 'sm' && 'text-[0.625rem] leading-none',
        size === 'md' && 'text-xs leading-tight',
        className,
      )}
      aria-label={pl.proBadge}
    >
      {pl.proBadge}
    </span>
  )
}
