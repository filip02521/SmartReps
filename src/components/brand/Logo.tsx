import { useId } from 'react'
import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'

export function LogoMark({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/:/g, '')
  const gradId = `sr-logo-grad-${uid}`
  const glowId = `sr-logo-glow-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--sr-brand-primary)" />
          <stop offset="0.5" stopColor="var(--sr-brand-primary)" />
          <stop offset="1" stopColor="var(--sr-brand-secondary)" />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* Outer ring — solid gradient circle */}
      <circle
        cx="20"
        cy="20"
        r="17"
        stroke={`url(#${gradId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Inner accent arc — secondary color, creates depth */}
      <path
        d="M 20 5 A 15 15 0 0 1 35 20"
        stroke="var(--sr-brand-secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
        fill="none"
      />
      {/* Letter R — brand primary with subtle glow */}
      <text
        x="20"
        y="26"
        textAnchor="middle"
        fill={`url(#${gradId})`}
        fontSize="16"
        fontWeight="800"
        fontFamily="var(--sr-font)"
        filter={`url(#${glowId})`}
      >
        R
      </text>
    </svg>
  )
}

export function LogoFull({ height = 28, className }: { height?: number; className?: string }) {
  return (
    <div
      className={cn('flex items-center gap-2.5', className)}
      style={{ height }}
      role="img"
      aria-label={pl.appName}
    >
      <LogoMark size={height} />
      <span className="text-lg font-bold tracking-tight leading-none" aria-hidden>
        <span className="font-normal text-[var(--sr-text-primary)]">Smart</span>
        <span className="sr-gradient-text">Reps</span>
      </span>
    </div>
  )
}
