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
  const goalMet = goal && frac >= 1

  return (
    <div className={cn(className)}>
      <div
        className={cn(
          'grid gap-2',
          items.length <= 2 ? 'grid-cols-2' : 'grid-cols-3',
        )}
      >
        {items.map((m, i) => (
          <div
            key={i}
            className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-2 py-3 text-center transition-colors hover:border-[var(--sr-border-strong)]"
          >
            <p className="text-xl font-bold tabular-nums leading-none text-[var(--sr-text-primary)]">
              {m.value}
            </p>
            <p className="mt-2 sr-text-caption leading-snug text-[var(--sr-text-secondary)]">
              {m.label}
            </p>
            {m.hint && (
              <p className="mt-0.5 sr-text-caption text-[var(--sr-text-muted)]">{m.hint}</p>
            )}
          </div>
        ))}
      </div>

      {goal && (
        <div
          className={cn(
            'mt-2 flex items-center gap-2.5 rounded-[var(--sr-radius-md)] border px-3 py-2',
            goalMet
              ? 'border-[color-mix(in_srgb,var(--sr-success)_30%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-success)_6%,var(--sr-bg-surface))]'
              : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
          )}
        >
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--sr-bg-elevated)]"
            role="progressbar"
            aria-valuenow={Math.min(goal.current, goal.max)}
            aria-valuemin={0}
            aria-valuemax={goal.max}
            aria-label={goal.label}
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none',
                goalMet ? 'bg-[var(--sr-success)]' : 'bg-[var(--sr-brand-primary)]',
              )}
              style={{ width: `${frac * 100}%` }}
            />
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5">
            <span className="sr-text-caption font-semibold tabular-nums text-[var(--sr-text-primary)]">
              {Math.min(goal.current, goal.max)}/{goal.max}
            </span>
            <span className="sr-text-caption text-[var(--sr-text-muted)]">{goal.label}</span>
          </div>
        </div>
      )}
    </div>
  )
}
