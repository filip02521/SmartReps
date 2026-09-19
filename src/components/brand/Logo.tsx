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
export function LogoMark({
  size = 40,
  tone = 'gradient',
  label,
}: {
  size?: number
  /** 'gradient' = brand moments only (splash, login, onboarding, app icons).
      'tonal' = in-app chrome — muted-indigo tile + indigo bars, the same
      accent pattern as StatusPill / ChipRail / icon badges, so the mark
      reads as part of the design system rather than pasted on top of it. */
  tone?: 'gradient' | 'tonal'
  /** Accessible name — when set, the mark exposes role="img". */
  label?: string
}) {
  const uid = useId().replace(/[:]/g, '')
  const gradId = `sr-logo-grad-${uid}`
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  const tonal = tone === 'tonal'
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" {...a11y}>
      {!tonal && (
        <defs>
          <linearGradient id={gradId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="0.55" stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
        </defs>
      )}
      <rect
        width="64"
        height="64"
        rx="16"
        fill={tonal ? 'var(--sr-brand-primary-muted)' : `url(#${gradId})`}
      />
      <rect x="13" y="37" width="9" height="8" rx="3" fill={tonal ? 'var(--sr-brand-primary)' : 'white'} />
      <rect x="27.5" y="29" width="9" height="16" rx="3" fill={tonal ? 'var(--sr-brand-primary)' : 'white'} />
      <rect x="42" y="19" width="9" height="26" rx="3" fill={tonal ? 'var(--sr-brand-primary)' : 'white'} />
    </svg>
  )
}

export function LogoFull({
  height = 28,
  tone = 'gradient',
  className,
}: {
  height?: number
  /** 'gradient' = brand moments (splash, login, onboarding).
      'tonal' = everyday chrome — tonal tile + ink wordmark; the Smart/Reps
      split is carried by weight and ink tone instead of gradient text. */
  tone?: 'gradient' | 'tonal'
  className?: string
}) {
  // Wordmark + gap scale with the mark — fixed text-lg left the wordmark
  // undersized next to larger marks (e.g. h=40 on the login screen).
  const fontSize = Math.round(height * 0.55)
  const gap = Math.round(height * 0.28)
  return (
    <div
      className={cn('flex items-center', className)}
      style={{ height, gap }}
      role="img"
      aria-label={pl.appName}
    >
      <LogoMark size={height} tone={tone} />
      <span className="font-bold tracking-tight leading-none" style={{ fontSize }} aria-hidden>
        <span
          className={cn(
            'font-normal',
            tone === 'tonal' ? 'text-[var(--sr-text-secondary)]' : 'text-[var(--sr-text-primary)]',
          )}
        >
          Smart
        </span>
        <span className={tone === 'tonal' ? 'text-[var(--sr-text-primary)]' : 'sr-gradient-text'}>
          Reps
        </span>
      </span>
    </div>
  )
}
