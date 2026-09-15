import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import { StatusPill } from '@/components/ui/StatusPill'

/**
 * "PRO" badge — marks Pro-only features in the UI.
 * Uses brand gradient to stand out from regular badges.
 *
 * Shown next to Pro-gated features; the surrounding control opens ProTeaser.
 * Chrome comes from the shared StatusPill system.
 */
export function ProBadge({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <StatusPill
      tone="brand"
      size={size === 'md' ? 'md' : 'xs'}
      ariaLabel={pl.proBadge}
      className={cn(
        'font-bold uppercase tracking-wide text-[var(--sr-brand-primary-hover)]',
        size === 'sm' && 'text-[0.625rem] leading-none',
        className,
      )}
    >
      {pl.proBadge}
    </StatusPill>
  )
}
