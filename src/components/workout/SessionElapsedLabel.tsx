import { Clock } from 'lucide-react'
import { useSessionElapsed } from '@/hooks/useSessionElapsed'
import { formatSessionElapsed } from '@/lib/session-elapsed'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

/** Quiet live session clock for workout headers (POZIOM 3 chrome). */
export function SessionElapsedLabel({
  startedAt,
  className,
}: {
  startedAt: string
  className?: string
}) {
  const elapsedSec = useSessionElapsed(startedAt)
  const label = formatSessionElapsed(elapsedSec)

  return (
    <p
      className={cn(
        'inline-flex items-center justify-center gap-1 tabular-nums sr-text-caption text-[var(--sr-text-muted)]',
        className,
      )}
      aria-label={pl.workoutElapsedAria(label)}
    >
      <Clock size={12} strokeWidth={2.25} className="shrink-0 opacity-80" aria-hidden />
      <span>{label}</span>
    </p>
  )
}
