import { useId } from 'react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<Size, { box: number; ring: number; font: number; sparkle: number }> = {
  sm: { box: 28, ring: 2, font: 11, sparkle: 8 },
  md: { box: 36, ring: 2.5, font: 14, sparkle: 10 },
  lg: { box: 48, ring: 3, font: 18, sparkle: 12 },
  xl: { box: 64, ring: 3.5, font: 24, sparkle: 14 },
}

/**
 * SmartReps AI Coach mark — brand gradient ring with "R" glyph
 * and a subtle sparkle indicator distinguishing it as the AI persona.
 *
 * Visual language:
 *  - Gradient ring (indigo → cyan) ties to SmartReps brand
 *  - "R" mark = SmartReps identity
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
          <linearGradient id={gradId} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="0.5" stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
        </defs>
        {/* Outer ring */}
        <circle
          cx="32"
          cy="32"
          r="27"
          stroke={`url(#${gradId})`}
          strokeWidth={dim.ring}
          strokeLinecap="round"
        />
        {/* Inner accent arc */}
        <path
          d="M 32 7 A 25 25 0 0 1 57 32"
          stroke="var(--sr-brand-secondary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.4"
          fill="none"
        />
        {/* R glyph — drawn as path for consistent rendering */}
        <path
          d="M 26 22 L 26 42 M 26 22 L 34 22 Q 40 22 40 28 Q 40 33 34 33 L 26 33 M 33 33 L 40 42"
          stroke={`url(#${gradId})`}
          strokeWidth={dim.ring + 1}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {/* Sparkle indicator — top-right, signals AI */}
      <span
        className="absolute -right-0.5 -top-0.5 flex items-center justify-center rounded-full"
        style={{
          width: dim.sparkle,
          height: dim.sparkle,
          background: 'var(--sr-brand-secondary)',
          boxShadow: '0 0 6px var(--sr-brand-secondary-muted)',
        }}
      >
        <svg
          width={dim.sparkle * 0.6}
          height={dim.sparkle * 0.6}
          viewBox="0 0 10 10"
          fill="none"
        >
          <path
            d="M5 0.5L6.2 3.8L9.5 5L6.2 6.2L5 9.5L3.8 6.2L0.5 5L3.8 3.8L5 0.5Z"
            fill="white"
          />
        </svg>
      </span>
    </span>
  )
}
