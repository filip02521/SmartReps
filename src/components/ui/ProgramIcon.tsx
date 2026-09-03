import type { Program } from '@/data/plans/types'

const accentVar: Record<Program, string> = {
  pushups: 'var(--sr-pushups-accent)',
  pullups: 'var(--sr-pullups-accent)',
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
        {/* Head */}
        <circle cx="5" cy="9" r="2.5" fill={accent} />
        {/* Body — horizontal plank */}
        <rect x="6" y="11" width="14" height="2.5" rx="1.25" fill={accent} />
        {/* Arms — down to ground */}
        <rect x="5.5" y="11" width="2" height="6" rx="1" fill={accent} />
        {/* Legs — to ground */}
        <rect x="18" y="11" width="2" height="6" rx="1" fill={accent} />
        {/* Ground line */}
        <rect x="2" y="18.5" width="20" height="1.5" rx="0.75" fill={accent} opacity="0.4" />
      </svg>
    )
  }

  // pullups — bar with person hanging
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* Bar */}
      <rect x="2" y="4" width="20" height="2" rx="1" fill={accent} />
      {/* Bar supports */}
      <rect x="2" y="4" width="1.5" height="3" rx="0.75" fill={accent} opacity="0.5" />
      <rect x="20.5" y="4" width="1.5" height="3" rx="0.75" fill={accent} opacity="0.5" />
      {/* Head */}
      <circle cx="12" cy="10" r="2.5" fill={accent} />
      {/* Arms — up to bar */}
      <rect x="9.5" y="6" width="2" height="4.5" rx="1" fill={accent} />
      <rect x="12.5" y="6" width="2" height="4.5" rx="1" fill={accent} />
      {/* Body */}
      <rect x="10.5" y="12" width="3" height="6" rx="1.25" fill={accent} />
    </svg>
  )
}

export function programAccent(program: Program): string {
  return accentVar[program]
}
