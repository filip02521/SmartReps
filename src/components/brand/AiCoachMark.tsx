import { useId } from 'react'
import { cn } from '@/lib/utils'

type Size = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<Size, { box: number }> = {
  sm: { box: 28 },
  md: { box: 36 },
  lg: { box: 48 },
  xl: { box: 64 },
}

/**
 * SmartReps AI Coach mark — the brand's AI persona indicator.
 *
 * Visual language (consistent with LogoMark "The Ascend"):
 *  - Filled gradient disc (indigo → cyan) = SmartReps brand
 *  - White ascending bars = SmartReps identity, same symbol as the logo
 *  - 4-point sparkle on the rim = AI intelligence layer
 *  - Multi-layer depth: outer glow + highlight + inner ring + bottom shadow
 *  - Optional sparkle shimmer when the coach is "thinking"
 *
 * All elements live inside a single SVG for perfect scaling at any size.
 */
export function AiCoachMark({
  size = 'md',
  pulse = false,
  className,
}: {
  size?: Size
  /** Animate the sparkle with a gentle shimmer when the coach is processing. */
  pulse?: boolean
  className?: string
}) {
  const uid = useId().replace(/[:]/g, '')
  const gradId = `sr-coach-grad-${uid}`
  const haloId = `sr-coach-halo-${uid}`
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
      >
        <defs>
          {/* Brand gradient — indigo → cyan, diagonal */}
          <linearGradient id={gradId} x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--sr-brand-primary)" />
            <stop offset="0.55" stopColor="var(--sr-brand-primary)" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" />
          </linearGradient>
          {/* Radial halo for sparkle glow */}
          <radialGradient id={haloId} cx="0.5" cy="0.5" r="0.5">
            <stop stopColor="var(--sr-brand-secondary)" stopOpacity="0.55" />
            <stop offset="1" stopColor="var(--sr-brand-secondary)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft outer glow — depth against any background */}
        <circle cx="32" cy="32" r="28" fill={`url(#${gradId})`} opacity="0.16" />

        {/* Main filled gradient disc */}
        <circle cx="32" cy="32" r="26" fill={`url(#${gradId})`} />

        {/* Inner highlight — top-left light source, 3D spherical depth */}
        <ellipse cx="23" cy="19" rx="17" ry="13" fill="white" opacity="0.12" />

        {/* Bottom inner shadow — grounds the sphere */}
        <ellipse cx="36" cy="46" rx="20" ry="10" fill="black" opacity="0.07" />

        {/* Crisp inner ring — edge definition against varied backgrounds */}
        <circle cx="32" cy="32" r="25.5" fill="none" stroke="white" strokeWidth="0.5" opacity="0.18" />

        {/* Ascending bars — same symbol as LogoMark, scaled to fit the disc.
            Three white rounded rectangles, bottom-aligned, increasing height.
            Height ratio 1:2:3.2 matches LogoMark. Vertically centered at disc center.
            Represents progress + reps = the SmartReps identity. */}
        <rect x="21" y="35" width="6" height="5" rx="2" fill="white" />
        <rect x="29" y="30" width="6" height="10" rx="2" fill="white" />
        <rect x="37" y="24" width="6" height="16" rx="2" fill="white" />

        {/* Sparkle halo — soft glow behind the star */}
        <circle
          cx="49" cy="15" r="8"
          fill={`url(#${haloId})`}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          className={cn(
            pulse && 'animate-[sr-coach-sparkle_2.4s_ease-in-out_infinite] motion-reduce:animate-none',
          )}
        />

        {/* Sparkle — 4-point star on the rim, signals AI intelligence */}
        <path
          d="M49 9 L50.2 13.8 L55 15 L50.2 16.2 L49 21 L47.8 16.2 L43 15 L47.8 13.8 Z"
          fill="white"
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          className={cn(
            pulse && 'animate-[sr-coach-sparkle_2.4s_ease-in-out_infinite] motion-reduce:animate-none',
          )}
        />
      </svg>
    </span>
  )
}
