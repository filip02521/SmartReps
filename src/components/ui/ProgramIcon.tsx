import type { Program } from '@/data/plans/types'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
  squats: 'var(--sr-squats-accent)',
}

const accentLight: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent-muted)',
  pullups: 'var(--sr-pullups-accent-muted)',
  squats: 'var(--sr-squats-accent-muted)',
}

/**
 * Professional program icons — unified silhouettes with overlapping shapes
 * so body parts connect into one cohesive figure. No gaps between head,
 * torso, arms, legs. Uses currentColor for accent control.
 */
export function ProgramIcon({
  program,
  size = 20,
  className,
}: {
  program: Program
  size?: number
  className?: string
}) {
  if (program === 'pushups') {
    // Pushup — side plank view: head left, body horizontal, arm + leg to ground
    // Head overlaps torso, arm overlaps torso, leg overlaps torso — no gaps
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden
      >
        {/* Ground line */}
        <rect x="2" y="19" width="20" height="1.5" rx="0.75" opacity="0.2" />
        {/* Torso — horizontal plank, starts inside head circle */}
        <rect x="4.5" y="8.5" width="14" height="3.5" rx="1.75" />
        {/* Head — overlaps left end of torso */}
        <circle cx="5" cy="10" r="2.8" />
        {/* Arm — overlaps torso, goes straight down to ground */}
        <rect x="7" y="9.5" width="2.8" height="10" rx="1.4" />
        {/* Leg — overlaps right end of torso, angled down (trapezoid) */}
        <path d="M 15 9.5 L 19 9.5 L 20.5 19 L 17 19 Z" />
      </svg>
    )
  }

  if (program === 'squats') {
    // Squat — front view: head top, compact torso, arms forward, bent legs
    // Head overlaps torso, arms overlap torso, legs overlap torso — no gaps
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden
      >
        {/* Ground line */}
        <rect x="2" y="19" width="20" height="1.5" rx="0.75" opacity="0.2" />
        {/* Torso — trapezoid (narrow top, wider bottom), overlaps head */}
        <path d="M 10 6.5 L 14 6.5 L 15 12 L 9 12 Z" />
        {/* Head — overlaps top of torso */}
        <circle cx="12" cy="5" r="2.8" />
        {/* Arms — horizontal bar extending from torso sides */}
        <rect x="5" y="8" width="14" height="2.2" rx="1.1" />
        {/* Left leg — bent at knee, overlaps torso bottom */}
        <path d="M 9 11 L 11.2 11 L 10 15 L 8 19 L 5.5 19 L 7.5 14.5 Z" />
        {/* Right leg — bent at knee, overlaps torso bottom */}
        <path d="M 12.8 11 L 15 11 L 16.5 14.5 L 18.5 19 L 16 19 L 14 15 Z" />
      </svg>
    )
  }

  // Pullups — bar at top, person hanging: arms up to bar, head, torso, legs
  // Arms overlap bar and head, head overlaps torso, torso overlaps legs — no gaps
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      {/* Bar — horizontal with side supports */}
      <rect x="2" y="3" width="20" height="2.5" rx="1.25" />
      <rect x="2.5" y="3" width="1.5" height="4" rx="0.75" opacity="0.5" />
      <rect x="20" y="3" width="1.5" height="4" rx="0.75" opacity="0.5" />
      {/* Left arm — starts inside bar, goes down, overlaps head */}
      <rect x="9" y="4.5" width="2.5" height="7" rx="1.25" />
      {/* Right arm — starts inside bar, goes down, overlaps head */}
      <rect x="12.5" y="4.5" width="2.5" height="7" rx="1.25" />
      {/* Head — overlaps arms and torso */}
      <circle cx="12" cy="11" r="2.8" />
      {/* Torso — overlaps head, goes down */}
      <rect x="9.5" y="12" width="5" height="7" rx="2.5" />
      {/* Left leg — overlaps torso bottom */}
      <rect x="9" y="18" width="2.2" height="3.5" rx="1.1" />
      {/* Right leg — overlaps torso bottom */}
      <rect x="12.8" y="18" width="2.2" height="3.5" rx="1.1" />
    </svg>
  )
}

export function programAccent(program: Program): string {
  return accentVar[program]
}

export function programAccentMuted(program: Program): string {
  return accentLight[program]
}
