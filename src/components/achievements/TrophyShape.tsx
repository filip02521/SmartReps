import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { TrophyTier } from '@/lib/achievements/trophy-tier'

/**
 * Trophy shapes per tier — metallic SVG trophies that replace the flat Lucide icon
 * for higher-tier achievements. Each shape has a unique silhouette and material gradient.
 *
 * - bronze  → Medal   (round medal with ribbon)
 * - silver  → Shield  (heraldic shield)
 * - gold    → Cup     (trophy cup with handles)
 * - diamond → Diamond (faceted gem)
 *
 * Locked / common / rare achievements keep the original Lucide icon.
 */

export type { TrophyTier }

type Size = 'sm' | 'md' | 'lg'

const SIZE_PX: Record<Size, number> = {
  sm: 20,
  md: 28,
  lg: 48,
}

const VIEWBOX = 48

/** Metallic gradient stops per tier — light highlight → base → dark shadow. */
const GRADIENT_STOPS: Record<TrophyTier, { hi: string; mid: string; lo: string }> = {
  bronze: { hi: '#f0c08a', mid: '#b87333', lo: '#6b3f1d' },
  silver: { hi: '#f5f7fa', mid: '#c0c8d4', lo: '#7a8290' },
  gold: { hi: '#fff4d0', mid: '#fbbf24', lo: '#b45309' },
  diamond: { hi: '#e0f2ff', mid: '#a78bfa', lo: '#5b21b6' },
}

export function TrophyShape({
  tier,
  size = 'md',
  px,
  className,
  ariaHidden = false,
  silhouette = false,
}: {
  tier: TrophyTier
  size?: Size
  /** Override pixel size directly (takes precedence over `size`). */
  px?: number
  className?: string
  ariaHidden?: boolean
  /** Render as dark silhouette (for locked achievements — hints at the trophy shape). */
  silhouette?: boolean
}) {
  const uid = useId().replace(/[:]/g, '')
  const finalPx = px ?? SIZE_PX[size]
  const stops = GRADIENT_STOPS[tier]
  const gradId = `sr-trophy-${tier}-${uid}`
  const shineId = `sr-trophy-shine-${uid}`
  const silhouetteFill = 'var(--sr-text-muted)'

  return (
    <svg
      width={finalPx}
      height={finalPx}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      fill="none"
      className={cn('sr-trophy', `sr-trophy--${tier}`, silhouette && 'sr-trophy--silhouette', className)}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : 'img'}
    >
      <defs>
        <linearGradient id={gradId} x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={silhouette ? silhouetteFill : stops.hi} />
          <stop offset="45%" stopColor={silhouette ? silhouetteFill : stops.mid} />
          <stop offset="100%" stopColor={silhouette ? silhouetteFill : stops.lo} />
        </linearGradient>
        <linearGradient id={shineId} x1="12" y1="6" x2="22" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={silhouette ? 'transparent' : '#ffffff'} stopOpacity={silhouette ? 0 : 0.55} />
          <stop offset="60%" stopColor={silhouette ? 'transparent' : '#ffffff'} stopOpacity={silhouette ? 0 : 0.12} />
          <stop offset="100%" stopColor={silhouette ? 'transparent' : '#ffffff'} stopOpacity={0} />
        </linearGradient>
      </defs>

      {tier === 'bronze' && <MedalShape gradId={gradId} shineId={shineId} silhouette={silhouette} />}
      {tier === 'silver' && <ShieldShape gradId={gradId} shineId={shineId} silhouette={silhouette} />}
      {tier === 'gold' && <CupShape gradId={gradId} shineId={shineId} silhouette={silhouette} />}
      {tier === 'diamond' && <DiamondShape gradId={gradId} shineId={shineId} silhouette={silhouette} />}
    </svg>
  )
}

/* ── Shapes ── */

type ShapeProps = { gradId: string; shineId: string; silhouette?: boolean }

function MedalShape({ gradId, shineId, silhouette }: ShapeProps) {
  return (
    <g>
      {/* Ribbon */}
      <path
        d="M17 4 L22 16 L14 16 L9 4 Z"
        fill={silhouette ? `url(#${gradId})` : 'var(--sr-brand-primary)'}
        opacity={silhouette ? 0.5 : 0.85}
      />
      <path
        d="M31 4 L26 16 L34 16 L39 4 Z"
        fill={silhouette ? `url(#${gradId})` : 'var(--sr-brand-secondary)'}
        opacity={silhouette ? 0.5 : 0.85}
      />
      {/* Medal body */}
      <circle cx="24" cy="28" r="13" fill={`url(#${gradId})`} stroke={silhouette ? 'none' : GRADIENT_STOPS.bronze.lo} strokeWidth="0.8" />
      {!silhouette && (
        <>
          {/* Inner ring */}
          <circle cx="24" cy="28" r="9.5" fill="none" stroke={GRADIENT_STOPS.bronze.lo} strokeWidth="0.6" opacity="0.5" />
          {/* Star center */}
          <path
            d="M24 22 L25.6 26 L29.8 26.2 L26.5 28.8 L27.7 32.8 L24 30.5 L20.3 32.8 L21.5 28.8 L18.2 26.2 L22.4 26 Z"
            fill={GRADIENT_STOPS.bronze.lo}
            opacity="0.75"
          />
          {/* Shine */}
          <ellipse cx="19" cy="22" rx="6" ry="4" fill={`url(#${shineId})`} />
        </>
      )}
    </g>
  )
}

function ShieldShape({ gradId, shineId, silhouette }: ShapeProps) {
  return (
    <g>
      {/* Shield body */}
      <path
        d="M24 5 L39 10 V24 C39 33 32 40 24 43 C16 40 9 33 9 24 V10 Z"
        fill={`url(#${gradId})`}
        stroke={silhouette ? 'none' : GRADIENT_STOPS.silver.lo}
        strokeWidth="0.8"
      />
      {!silhouette && (
        <>
          {/* Inner border */}
          <path
            d="M24 9 L35 12.5 V24 C35 30.5 30 35.5 24 38 C18 35.5 13 30.5 13 24 V12.5 Z"
            fill="none"
            stroke={GRADIENT_STOPS.silver.lo}
            strokeWidth="0.5"
            opacity="0.5"
          />
          {/* Cross emblem */}
          <path
            d="M22 16 H26 V22 H32 V26 H26 V32 H22 V26 H16 V22 H22 Z"
            fill={GRADIENT_STOPS.silver.lo}
            opacity="0.7"
          />
          {/* Shine */}
          <path
            d="M24 5 L39 10 V24 C39 28 37.5 31.5 35 34 L24 9 Z"
            fill={`url(#${shineId})`}
            opacity="0.6"
          />
        </>
      )}
    </g>
  )
}

function CupShape({ gradId, shineId, silhouette }: ShapeProps) {
  return (
    <g>
      {/* Left handle */}
      <path
        d="M9 14 C4 14 4 22 9 24 L13 22 C10 21 10 17 13 16 Z"
        fill={`url(#${gradId})`}
        stroke={silhouette ? 'none' : GRADIENT_STOPS.gold.lo}
        strokeWidth="0.5"
      />
      {/* Right handle */}
      <path
        d="M39 14 C44 14 44 22 39 24 L35 22 C38 21 38 17 35 16 Z"
        fill={`url(#${gradId})`}
        stroke={silhouette ? 'none' : GRADIENT_STOPS.gold.lo}
        strokeWidth="0.5"
      />
      {/* Cup bowl */}
      <path
        d="M11 10 H37 V18 C37 25 31 30 24 30 C17 30 11 25 11 18 Z"
        fill={`url(#${gradId})`}
        stroke={silhouette ? 'none' : GRADIENT_STOPS.gold.lo}
        strokeWidth="0.8"
      />
      {/* Stem */}
      <rect x="22" y="30" width="4" height="7" fill={`url(#${gradId})`} stroke={silhouette ? 'none' : GRADIENT_STOPS.gold.lo} strokeWidth="0.4" />
      {/* Base */}
      <path
        d="M14 37 H34 L32 43 H16 Z"
        fill={`url(#${gradId})`}
        stroke={silhouette ? 'none' : GRADIENT_STOPS.gold.lo}
        strokeWidth="0.6"
      />
      {!silhouette && (
        <>
          {/* Rim highlight */}
          <ellipse cx="24" cy="11" rx="12.5" ry="2" fill={GRADIENT_STOPS.gold.hi} opacity="0.7" />
          {/* Base highlight */}
          <rect x="17" y="38" width="14" height="1.2" fill={GRADIENT_STOPS.gold.hi} opacity="0.6" />
          {/* Star on cup */}
          <path
            d="M24 14 L25.2 17.2 L28.6 17.4 L26 19.6 L26.9 22.8 L24 21 L21.1 22.8 L22 19.6 L19.4 17.4 L22.8 17.2 Z"
            fill={GRADIENT_STOPS.gold.lo}
            opacity="0.65"
          />
          {/* Shine */}
          <path d="M13 10 L20 10 L17 26 L13 22 Z" fill={`url(#${shineId})`} />
        </>
      )}
    </g>
  )
}

function DiamondShape({ gradId, shineId, silhouette }: ShapeProps) {
  return (
    <g>
      {/* Top facets */}
      <path d="M14 12 L24 6 L34 12 L30 14 L24 11 L18 14 Z" fill={`url(#${gradId})`} stroke={silhouette ? 'none' : GRADIENT_STOPS.diamond.lo} strokeWidth="0.5" />
      {/* Crown */}
      <path d="M18 14 L24 11 L30 14 L32 18 L24 16 L16 18 Z" fill={`url(#${gradId})`} stroke={silhouette ? 'none' : GRADIENT_STOPS.diamond.lo} strokeWidth="0.5" />
      {/* Pavilion (bottom) */}
      <path d="M16 18 L24 16 L32 18 L24 42 Z" fill={`url(#${gradId})`} stroke={silhouette ? 'none' : GRADIENT_STOPS.diamond.lo} strokeWidth="0.6" />
      {!silhouette && (
        <>
          {/* Facet lines */}
          <path d="M16 18 L24 22 L32 18" fill="none" stroke={GRADIENT_STOPS.diamond.lo} strokeWidth="0.4" opacity="0.6" />
          <path d="M20 14 L24 22 L28 14" fill="none" stroke={GRADIENT_STOPS.diamond.lo} strokeWidth="0.3" opacity="0.4" />
          <path d="M24 22 L24 42" fill="none" stroke={GRADIENT_STOPS.diamond.lo} strokeWidth="0.3" opacity="0.4" />
          {/* Sparkle */}
          <circle cx="20" cy="16" r="1.2" fill="#ffffff" opacity="0.85" />
          <circle cx="28" cy="20" r="0.8" fill="#ffffff" opacity="0.6" />
          {/* Shine sweep */}
          <path d="M14 12 L24 6 L26 8 L16 14 Z" fill={`url(#${shineId})`} />
        </>
      )}
    </g>
  )
}
