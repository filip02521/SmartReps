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

const STROKE_PROPS = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * Professional line-art icons for pushup / pullup / squat programs.
 * Consistent stroke weight (1.75), rounded caps/joins, no gradients.
 * Uses `currentColor` — set text color via CSS to control accent.
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
    // Pushup — plank position, side view: head left, body horizontal, arm + leg to ground
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        className={className}
        aria-hidden
        {...STROKE_PROPS}
      >
        {/* Ground line */}
        <path d="M3 20.5 L21 20.5" opacity="0.35" strokeWidth="1.5" />
        {/* Head */}
        <circle cx="5" cy="11" r="2" />
        {/* Torso — horizontal plank */}
        <path d="M7 11 L18 12" />
        {/* Arm — from shoulder down to ground */}
        <path d="M9 11.2 L9 20" />
        {/* Leg — from hip down to ground */}
        <path d="M17.5 12 L18 20" />
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
        className={className}
        aria-hidden
        {...STROKE_PROPS}
      >
        {/* Ground line */}
        <path d="M3 20.5 L21 20.5" opacity="0.35" strokeWidth="1.5" />
        {/* Head */}
        <circle cx="12" cy="5" r="2" />
        {/* Torso — compact, slightly leaned forward (squat posture) */}
        <path d="M12 7 L11.5 12" />
        {/* Arms — extended forward for balance */}
        <path d="M11.7 9 L7 9.5 M12.3 9 L17 9.5" />
        {/* Left leg — bent at knee */}
        <path d="M11.5 12 L8 15 L8 20" />
        {/* Right leg — bent at knee */}
        <path d="M12.5 12 L16 15 L16 20" />
      </svg>
    )
  }

  // Pullups — bar at top, person hanging: arms up, head, torso, legs
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      {...STROKE_PROPS}
    >
      {/* Bar — horizontal with supports */}
      <path d="M3 4 L21 4" strokeWidth="2" />
      <path d="M3 4 L3 5.5 M21 4 L21 5.5" opacity="0.5" strokeWidth="1.5" />
      {/* Arms — reaching up to bar */}
      <path d="M9.5 5.5 L10.5 10 M14.5 5.5 L13.5 10" />
      {/* Head */}
      <circle cx="12" cy="11.5" r="2" />
      {/* Torso — hanging straight down */}
      <path d="M12 13.5 L12 18" />
      {/* Legs — slightly bent */}
      <path d="M12 18 L10.5 21 M12 18 L13.5 21" />
    </svg>
  )
}

export function programAccent(program: Program): string {
  return accentVar[program]
}

export function programAccentMuted(program: Program): string {
  return accentLight[program]
}
