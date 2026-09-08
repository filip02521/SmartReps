import { History } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

export function PreviousResultBadge({
  actual,
  target,
  className,
}: {
  actual: number
  target: number
  className?: string
}) {
  const met = actual >= target
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tabular-nums',
        met
          ? 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)] text-[var(--sr-success)]'
          : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
        className,
      )}
      aria-label={pl.lastTime(actual, target)}
    >
      <History size={11} aria-hidden />
      {pl.lastTime(actual, target)}
    </span>
  )
}
