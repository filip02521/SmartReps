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
 * Professional program icons — thick-stroked pictograms.
 * Uses 2.5px stroke with round caps/joins so lines visually merge at joints,
 * creating connected figures without gaps. Each icon is immediately
 * recognizable at 18-28px and uses a consistent visual language.
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
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  if (program === 'pushups') {
    // Pushup — side plank view. Head left, body horizontal, arm down, leg angled.
    // Thick round-capped strokes merge at joints for a connected figure.
    return (
      <svg {...common}>
        {/* Ground line — subtle */}
        <path d="M 2 20.5 L 22 20.5" strokeWidth={1.5} opacity={0.2} />
        {/* Head */}
        <circle cx="5.5" cy="9.5" r="2.5" />
        {/* Body — from head to hip */}
        <path d="M 7.5 10.5 L 16 11.5" />
        {/* Arm — from shoulder down to ground */}
        <path d="M 8 11 L 8 20" />
        {/* Leg — from hip down to ground */}
        <path d="M 16 11.5 L 19 20" />
      </svg>
    )
  }

  if (program === 'squats') {
    // Squat — front view. Head top, arms forward, bent legs wide.
    return (
      <svg {...common}>
        {/* Ground line — subtle */}
        <path d="M 2 20.5 L 22 20.5" strokeWidth={1.5} opacity={0.2} />
        {/* Head */}
        <circle cx="12" cy="5" r="2.5" />
        {/* Torso — from head to hips */}
        <path d="M 12 7.5 L 12 12" />
        {/* Arms — extended forward for balance */}
        <path d="M 6 10.5 L 18 10.5" />
        {/* Left leg — bent at knee */}
        <path d="M 11 12 L 7.5 15 L 7 20" />
        {/* Right leg — bent at knee */}
        <path d="M 13 12 L 16.5 15 L 17 20" />
      </svg>
    )
  }

  // Pullups — bar at top, body hanging straight down.
  return (
    <svg {...common}>
      {/* Bar with side supports */}
      <path d="M 3 4 L 21 4" />
      <path d="M 4 4 L 4 6.5" strokeWidth={1.5} opacity={0.5} />
      <path d="M 20 4 L 20 6.5" strokeWidth={1.5} opacity={0.5} />
      {/* Arms — from bar down to head */}
      <path d="M 9.5 5 L 9.5 10" />
      <path d="M 14.5 5 L 14.5 10" />
      {/* Head */}
      <circle cx="12" cy="11" r="2.5" />
      {/* Torso — from head to legs */}
      <path d="M 12 13.5 L 12 18" />
      {/* Left leg */}
      <path d="M 12 18 L 10.5 20.5" />
      {/* Right leg */}
      <path d="M 12 18 L 13.5 20.5" />
    </svg>
  )
}

export function programAccent(program: Program): string {
  return accentVar[program]
}

export function programAccentMuted(program: Program): string {
  return accentLight[program]
}
