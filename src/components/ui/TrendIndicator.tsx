import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TrendIndicator({
  delta,
  className,
}: {
  delta: number | null
  className?: string
}) {
  if (delta === null) {
    return (
      <span className={cn('inline-flex items-center text-[var(--sr-text-muted)]', className)}>
        <Minus size={14} strokeWidth={2.5} />
      </span>
    )
  }
  if (delta > 0) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-[var(--sr-success)]', className)}>
        <TrendingUp size={14} strokeWidth={2.5} />
        <span className="tabular-nums">+{delta}</span>
      </span>
    )
  }
  if (delta < 0) {
    return (
      <span className={cn('inline-flex items-center gap-0.5 text-[var(--sr-error)]', className)}>
        <TrendingDown size={14} strokeWidth={2.5} />
        <span className="tabular-nums">{delta}</span>
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center text-[var(--sr-text-muted)]', className)}>
      <Minus size={14} strokeWidth={2.5} />
      <span className="tabular-nums">0</span>
    </span>
  )
}
