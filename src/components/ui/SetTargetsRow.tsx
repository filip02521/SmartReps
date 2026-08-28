import { cn } from '@/lib/utils'
import { formatSetTargetCompact } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'
import type { SetTarget } from '@/data/plans/types'

/** Scannable set-target chips — used on home cards and Plans day previews. */
export function SetTargetsRow({
  sets,
  className,
  size = 'md',
}: {
  sets: SetTarget[]
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label={pl.setColumn}>
      {sets.map((target, i) => (
        <li
          key={i}
          className={cn(
            'flex min-w-[2.5rem] flex-col items-center justify-center rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]',
            size === 'sm' ? 'px-2 py-1.5' : 'px-2.5 py-2',
          )}
        >
          <span className="sr-text-overline text-[var(--sr-text-muted)]">{i + 1}</span>
          <span
            className={cn(
              'font-semibold tabular-nums leading-tight text-[var(--sr-text-primary)]',
              size === 'sm' ? 'text-sm' : 'text-base',
            )}
          >
            {formatSetTargetCompact(target)}
          </span>
        </li>
      ))}
    </ul>
  )
}
