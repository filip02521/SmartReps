import { pl } from '@/i18n/pl'

export function PreviousResultBadge({
  actual,
  target,
}: {
  actual: number
  target: number
}) {
  return (
    <p className="text-sm text-[var(--sr-text-secondary)]">
      {pl.lastTime(actual, target)}
    </p>
  )
}
