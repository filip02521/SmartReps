import type { Program } from '@/data/plans/types'
import { useId } from 'react'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
}

const accentLight: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent-muted)',
  pullups: 'var(--sr-pullups-accent-muted)',
}

/** Compact inline SVG icon for pushup / pullup programs. */
export function ProgramIcon({
  program,
  size = 20,
  className,
}: {
  program: Program
  size?: number
  className?: string
}) {
  const accent = accentVar[program]
  const uid = useId().replace(/[:]/g, '')
  const gradId = `sr-progicon-${program}-${uid}`

  if (program === 'pushups') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className={className}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradId} x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={accent} stopOpacity="1" />
            <stop offset="100%" stopColor={accent} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        {/* Ground line — subtle */}
        <line x1="2" y1="19" x2="22" y2="19" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
        {/* Body — horizontal plank with slight curve for dynamic feel */}
        <path
          d="M5 13.5 C5 12 6 11.5 7.5 11.5 L16.5 11.5 C18 11.5 19 12 19 13.5 C19 14.5 18 15 16.5 15 L7.5 15 C6 15 5 14.5 5 13.5 Z"
          fill={`url(#${gradId})`}
        />
        {/* Head — circle with subtle highlight */}
        <circle cx="5.5" cy="10" r="2.2" fill={`url(#${gradId})`} />
        <circle cx="5" cy="9.5" r="0.7" fill="#ffffff" opacity="0.3" />
        {/* Arms — angled down to ground */}
        <path d="M6.5 11.5 L5.5 18" stroke={`url(#${gradId})`} strokeWidth="2" strokeLinecap="round" />
        {/* Legs — angled to ground */}
        <path d="M18 12 L19 18" stroke={`url(#${gradId})`} strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  }

  // pullups — bar with person hanging, more dynamic
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={accent} stopOpacity="1" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      {/* Bar — horizontal with supports */}
      <rect x="2" y="3.5" width="20" height="2" rx="1" fill={accent} opacity="0.6" />
      <path d="M2.5 3.5 L2.5 6 M21.5 3.5 L21.5 6" stroke={accent} strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      {/* Arms — up to bar, slightly angled for dynamic feel */}
      <path d="M9 7 L11 11 M15 7 L13 11" stroke={`url(#${gradId})`} strokeWidth="2" strokeLinecap="round" />
      {/* Head — circle with highlight */}
      <circle cx="12" cy="10.5" r="2.2" fill={`url(#${gradId})`} />
      <circle cx="11.3" cy="10" r="0.7" fill="#ffffff" opacity="0.3" />
      {/* Body — torso hanging down */}
      <path
        d="M10.5 12.5 L10.5 17 C10.5 18 11 18.5 12 18.5 C13 18.5 13.5 18 13.5 17 L13.5 12.5 Z"
        fill={`url(#${gradId})`}
      />
      {/* Legs — slightly bent for dynamic pose */}
      <path d="M11 18.5 L10.5 21 M13 18.5 L13.5 21" stroke={`url(#${gradId})`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function programAccent(program: Program): string {
  return accentVar[program]
}

export function programAccentMuted(program: Program): string {
  return accentLight[program]
}
