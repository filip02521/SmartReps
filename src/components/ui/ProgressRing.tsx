import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ProgressRing({
  progress,
  size = 220,
  strokeWidth = 8,
  className,
  children,
  reducedMotion,
}: {
  progress: number
  size?: number
  strokeWidth?: number
  className?: string
  children?: ReactNode
  reducedMotion?: boolean
}) {
  const r = (size - strokeWidth) / 2 - 4
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, progress))
  const offset = circumference * (1 - clamped)

  return (
    <div className={cn('relative inline-flex', className)} style={{ width: size, height: size }}>
      {!reducedMotion && (
        <svg width={size} height={size} className="-rotate-90" aria-hidden>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--sr-bg-surface)" strokeWidth={strokeWidth} />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="url(#sr-ring-gradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 300ms ease' }}
          />
          <defs>
            <linearGradient id="sr-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop stopColor="var(--sr-brand-primary)" />
              <stop offset="1" stopColor="var(--sr-brand-secondary)" />
            </linearGradient>
          </defs>
        </svg>
      )}
      {children && (
        <div className="absolute inset-0 flex items-center justify-center">{children}</div>
      )}
    </div>
  )
}
