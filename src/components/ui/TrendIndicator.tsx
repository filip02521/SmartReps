import { cn } from '@/lib/utils'

export function TrendIndicator({
  delta,
  className,
}: {
  delta: number | null
  className?: string
}) {
  if (delta === null) {
    return <span className={cn('text-[var(--sr-text-muted)]', className)}>—</span>
  }
  if (delta > 0) {
    return <span className={cn('text-[var(--sr-success)]', className)}>↑ +{delta}</span>
  }
  if (delta < 0) {
    return <span className={cn('text-[var(--sr-error)]', className)}>↓ {delta}</span>
  }
  return <span className={cn('text-[var(--sr-text-muted)]', className)}>→ 0</span>
}
