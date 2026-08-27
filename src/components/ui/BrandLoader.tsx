import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'

/** Indeterminate brand spinner — rotating gradient arc. */
export function BrandLoader({
  size = 48,
  className,
  label,
}: {
  size?: number
  className?: string
  label?: string
}) {
  const stroke = Math.max(3, Math.round(size * 0.09))
  const r = (size - stroke) / 2 - 1
  const c = 2 * Math.PI * r
  const arc = c * 0.22
  const gap = c - arc
  const gradId = `sr-loader-grad-${size}`

  return (
    <div
      className={cn('inline-flex items-center justify-center', className)}
      role="status"
      aria-live="polite"
      aria-label={label ?? pl.loading}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="sr-loader-spin"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--sr-bg-surface)"
          strokeWidth={stroke}
          opacity={0.9}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${gap}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
        </defs>
      </svg>
      <span className="sr-only">{label ?? pl.loading}</span>
    </div>
  )
}

/** Centered page/hydrate loading state with animated brand loader. */
export function PageLoader({
  className,
  message,
  compact,
}: {
  className?: string
  message?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 sr-loader-enter',
        compact ? 'py-10' : 'min-h-[40vh] py-16',
        className,
      )}
    >
      <BrandLoader size={compact ? 40 : 56} />
      <p className="sr-text-body-sm text-[var(--sr-text-muted)]">{message ?? pl.loading}</p>
    </div>
  )
}
