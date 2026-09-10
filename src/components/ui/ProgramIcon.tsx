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
 * Professional filled-silhouette icons for pushup / pullup / squat programs.
 * Solid fill via currentColor — parent sets text color to control accent.
 * Clean geometric shapes with rounded corners, instantly recognizable poses.
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
        {/* Head */}
        <circle cx="5" cy="10" r="2.3" />
        {/* Torso — horizontal plank */}
        <rect x="6.5" y="9.1" width="11" height="2.8" rx="1.4" />
        {/* Arm — straight down to ground */}
        <rect x="7.3" y="10" width="2.2" height="9" rx="1.1" />
        {/* Leg — angled down to ground (trapezoid) */}
        <path d="M15.5 10.8 L17.8 10.8 L19.2 19 L16.9 19 Z" />
      </svg>
    )
  }

  if (program === 'squats') {
    // Squat — front view: head top, torso, arms forward, bent legs
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
        {/* Head */}
        <circle cx="12" cy="5" r="2.3" />
        {/* Torso — compact, slightly forward lean */}
        <path d="M10.7 7.2 L13.3 7.2 L12.8 12 L11.2 12 Z" />
        {/* Arms — extended forward for balance */}
        <rect x="6" y="8.2" width="12" height="1.8" rx="0.9" />
        {/* Left leg — thigh + shin bent at knee */}
        <path d="M10.8 11.5 L8 14.5 L7.5 19 L9.5 19 L9.8 15.5 L11.8 13 Z" />
        {/* Right leg — thigh + shin bent at knee */}
        <path d="M13.2 11.5 L16 14.5 L16.5 19 L14.5 19 L14.2 15.5 L12.2 13 Z" />
      </svg>
    )
  }

  // Pullups — bar at top, person hanging: arms up, head, torso, legs
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      {/* Bar — horizontal with supports */}
      <rect x="2" y="3" width="20" height="2.2" rx="1.1" />
      <rect x="2.5" y="3" width="1.5" height="3.5" rx="0.75" opacity="0.5" />
      <rect x="20" y="3" width="1.5" height="3.5" rx="0.75" opacity="0.5" />
      {/* Arms — reaching up to bar */}
      <rect x="8.8" y="5" width="2.2" height="5" rx="1.1" />
      <rect x="13" y="5" width="2.2" height="5" rx="1.1" />
      {/* Head */}
      <circle cx="12" cy="11" r="2.3" />
      {/* Torso — hanging straight down */}
      <rect x="10.7" y="12.8" width="2.6" height="5.5" rx="1.3" />
      {/* Legs — slightly apart */}
      <rect x="9.5" y="18" width="2" height="3.5" rx="1" />
      <rect x="12.5" y="18" width="2" height="3.5" rx="1" />
    </svg>
  )
}

export function programAccent(program: Program): string {
  return accentVar[program]
}

export function programAccentMuted(program: Program): string {
  return accentLight[program]
}
