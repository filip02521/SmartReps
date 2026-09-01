import { cn } from '@/lib/utils'

const W = 72
const H = 32

export function ExerciseSparkline({
  values,
  className,
  active = true,
}: {
  values: number[]
  className?: string
  /** Dim when no training history yet. */
  active?: boolean
}) {
  if (values.length === 0) {
    return (
      <div
        className={cn(
          'flex h-9 w-[4.5rem] shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)]',
          'border border-dashed border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/60',
          className,
        )}
        aria-hidden
      >
        <span className="h-0.5 w-6 rounded-full bg-[var(--sr-border-strong)] opacity-40" />
      </div>
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 3

  const coords = values.map((v, i) => {
    const x =
      values.length === 1 ? W / 2 : pad + (i / (values.length - 1)) * (W - pad * 2)
    const y = pad + (1 - (v - min) / range) * (H - pad * 2)
    return { x, y }
  })

  const polyline = coords.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={cn('h-9 w-[4.5rem] shrink-0', !active && 'opacity-50', className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke="var(--sr-brand-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
        opacity={active ? 1 : 0.45}
      />
      {coords.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={values.length === 1 ? 3 : 2}
          fill="var(--sr-brand-primary)"
          opacity={i === coords.length - 1 ? 1 : 0.55}
        />
      ))}
    </svg>
  )
}
