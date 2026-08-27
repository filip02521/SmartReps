import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type MetricItem = {
  value: ReactNode
  label: string
  hint?: string
}

export function MetricStrip({
  metrics,
  goal,
  className,
}: {
  metrics: [MetricItem, MetricItem, MetricItem] | MetricItem[]
  goal?: { label: string; current: number; max: number }
  className?: string
}) {
  const items = metrics.slice(0, 3)
  const frac = goal ? Math.min(goal.current, goal.max) / Math.max(goal.max, 1) : 0

  return (
    <div className={cn(className)}>
      <div className="grid grid-cols-3 gap-2">
        {items.map((m, i) => (
          <div key={i} className="text-center">
            <p className="tabular-nums text-xl font-bold text-[var(--sr-text-primary)]">{m.value}</p>
            <p className="mt-0.5 sr-text-overline leading-tight text-[var(--sr-text-muted)] normal-case tracking-normal">
              {m.label}
            </p>
            {m.hint && (
              <p className="sr-text-caption text-[var(--sr-text-muted)]">{m.hint}</p>
            )}
          </div>
        ))}
      </div>

      {goal && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="sr-text-caption text-[var(--sr-text-muted)]">{goal.label}</p>
            <p className="sr-text-caption tabular-nums text-[var(--sr-text-muted)]">
              {Math.min(goal.current, goal.max)}/{goal.max}
            </p>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--sr-text-muted)_22%,transparent)]"
            role="progressbar"
            aria-valuenow={Math.min(goal.current, goal.max)}
            aria-valuemin={0}
            aria-valuemax={goal.max}
          >
            <div
              className="h-full rounded-full bg-[var(--sr-brand-primary)] transition-[width] duration-300 motion-reduce:transition-none"
              style={{ width: `${frac * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
