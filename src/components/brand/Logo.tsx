import { useId } from 'react'
import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'

/**
 * SmartReps LogoMark — "The Ascend"
 *
 * Three ascending white bars on a gradient tile (indigo → cyan).
 * Filled shapes (not strokes, not <text>) → crisp at every size, zero blur.
 *
 * Meaning:
 *  - Ascending bars = progress, progressive overload
 *  - Three bars = reps, sets, repetition
 *  - Gradient tile = brand consistency with UI (buttons, AiCoach, surfaces)
 */
export function LogoMark({ size = 40 }: { size?: number }) {
  const uid = useId().replace(/[:]/g, '')
  const gradId = `sr-logo-grad-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--sr-brand-primary)" />
          <stop offset="0.55" stopColor="var(--sr-brand-primary)" />
          <stop offset="1" stopColor="var(--sr-brand-secondary)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${gradId})`} />
      <rect x="13" y="37" width="9" height="8" rx="3" fill="white" />
      <rect x="27.5" y="29" width="9" height="16" rx="3" fill="white" />
      <rect x="42" y="19" width="9" height="26" rx="3" fill="white" />
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
