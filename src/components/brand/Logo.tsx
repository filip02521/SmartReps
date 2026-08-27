import { useId } from 'react'
import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'

export function LogoMark({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `sr-logo-grad-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="18" stroke={`url(#${gradId})`} strokeWidth="3" strokeDasharray="8 4" />
      <text x="20" y="25" textAnchor="middle" fill="var(--sr-brand-primary)" fontSize="14" fontWeight="700" fontFamily="var(--sr-font)">R</text>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="var(--sr-brand-primary)" />
          <stop offset="1" stopColor="var(--sr-brand-secondary)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export function LogoFull({ height = 28, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn('flex items-center gap-2', className)}
      style={{ height }}
      role="img"
      aria-label={pl.appName}
    >
      <LogoMark size={height} />
      <span className="text-lg font-bold tracking-tight" aria-hidden>
        <span className="font-normal text-[var(--sr-text-primary)]">Smart</span>
        <span className="sr-gradient-text">Reps</span>
      </span>
    </div>
  )
}
