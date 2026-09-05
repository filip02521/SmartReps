import { useId } from 'react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<Size, { box: number; ring: number; sparkle: number }> = {
  sm: { box: 28, ring: 2.5, sparkle: 9 },
  md: { box: 36, ring: 3, sparkle: 11 },
  lg: { box: 48, ring: 3.5, sparkle: 14 },
  xl: { box: 64, ring: 4, sparkle: 17 },
}

/**
 * SmartReps AI Coach mark — gradient circle with "R" glyph
 * and a sparkle dot distinguishing it as the AI persona.
 *
 * Visual language:
 *  - Filled gradient circle (indigo → cyan) = SmartReps brand
 *  - White "R" = SmartReps identity
 *  - Sparkle dot = AI intelligence layer
 *  - Optional pulse animation when the coach is "thinking"
 */
export function AiCoachMark({
  size = 'md',
  pulse = false,
  className,
}: {
  size?: Size
  /** Animate the ring with a gentle pulse when the coach is processing. */
  pulse?: boolean
  className?: string
}) {
  const uid = useId().replace(/[:]/g, '')
  const gradId = `sr-coach-grad-${uid}`
  const dim = SIZE_MAP[size]

  return (
    <span
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: dim.box, height: dim.box }}
      aria-hidden
    >
      <svg
        width={dim.box}
        height={dim.box}
        viewBox="0 0 64 64"
        fill="none"
        className={cn(pulse && 'animate-[sr-coach-pulse_2s_ease-in-out_infinite]')}
      >
        <defs>
          <linearGradient id={gradId} x1="8" y1="8" x2="56" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
        </defs>
        {/* Filled gradient circle */}
        <circle cx="32" cy="32" r="26" fill={`url(#${gradId})`} />
        {/* Subtle inner highlight — top-left light source */}
        <circle cx="24" cy="22" r="14" fill="white" opacity="0.08" />
        {/* "R" glyph — white, bold, centered */}
        <path
          d="M 23 18 L 23 46 M 23 18 L 33 18 Q 41 18 41 26 Q 41 33 33 33 L 23 33 M 31 33 L 41 46"
          stroke="white"
          strokeWidth={dim.ring}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {/* Sparkle indicator — top-right, signals AI */}
      <span
        className="absolute flex items-center justify-center rounded-full ring-2 ring-[var(--sr-bg-elevated)]"
        style={{
          width: dim.sparkle,
          height: dim.sparkle,
          right: -1,
          top: -1,
          background: 'var(--sr-brand-secondary)',
          boxShadow: '0 0 8px var(--sr-brand-secondary-muted)',
        }}
      >
        <svg
          width={Math.round(dim.sparkle * 0.55)}
          height={Math.round(dim.sparkle * 0.55)}
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M5 0.8L6 3.8L9.2 5L6 6.2L5 9.2L4 6.2L0.8 5L4 3.8L5 0.8Z"
            fill="white"
          />
        </svg>
      </span>
    </span>
  )
}
