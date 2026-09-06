import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { TrophyTier, TrophyShapeKind } from '@/lib/achievements/trophy-tier'

/**
 * Metallic SVG trophies with the achievement's semantic glyph overlaid.
 *
 * The SHAPE is determined by the achievement track (cup/shield/medal/crown/diamond),
 * giving each category a unique visual identity. The MATERIAL (tier) determines
 * the metallic gradient and fanfare — bronze/silver/gold/diamond.
 *
 * Shape → Track mapping:
 * - cup     → training (classic trophy for physical achievement)
 * - shield  → habit (consistency/streak = defense)
 * - medal   → catalog (community contribution = medal)
 * - crown   → legend (legendary status = crown)
 * - diamond → secret (mystery = precious gem)
 *
 * The glyph (Lucide icon) is rendered on top of the trophy shape,
 * in a color that contrasts with the metallic background.
 */

export type { TrophyTier, TrophyShapeKind }

type Size = 'sm' | 'md' | 'lg'

/** Trophy pixel sizes — large enough to fill the tile's inner area. */
const SIZE_PX: Record<Size, number> = {
  sm: 34,
  md: 52,
  lg: 80,
}

/** Glyph size as fraction of trophy size. */
const GLYPH_FRACTION: Record<TrophyShapeKind, number> = {
  cup: 0.34,
  shield: 0.38,
  medal: 0.36,
  crown: 0.30,
  diamond: 0.32,
}

/** Glyph color per tier — contrasts with metallic background. */
const GLYPH_COLOR: Record<TrophyTier, string> = {
  bronze: '#2d1408',
  silver: '#1a1d24',
  gold: '#5a3008',
  diamond: '#ffffff',
}

/**
 * Glyph vertical offset as fraction of trophy size (not glyph size).
 * Positive = down, negative = up. Positions the icon on each shape's "face".
 *
 * In viewBox coordinates (48×48), the visual center of each shape's face is:
 * - cup:     bowl center ≈ y=20 → offset from container center (24) = -4 → -4/48 ≈ -0.08
 * - shield:  body center ≈ y=24 → 0
 * - medal:   medal center ≈ y=30 → +6/48 ≈ +0.12
 * - crown:   face center ≈ y=28 → +4/48 ≈ +0.08
 * - diamond: gem center ≈ y=25 → +1/48 ≈ +0.02
 */
const GLYPH_OFFSET_FRACTION: Record<TrophyShapeKind, number> = {
  cup: -0.06,
  shield: -0.02,
  medal: 0.12,
  crown: 0.12,
  diamond: 0.02,
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
  shape,
  size = 'md',
  px,
  glyph,
  className,
  ariaHidden = false,
  silhouette = false,
  interactive = false,
}: {
  tier: TrophyTier
  /** Trophy shape — determines the silhouette. Derived from achievement track. */
  shape: TrophyShapeKind
  size?: Size
  /** Override pixel size directly (takes precedence over `size`). */
  px?: number
  /** Achievement glyph (Lucide icon element) rendered on top of the trophy. */
  glyph?: ReactNode
  className?: string
  ariaHidden?: boolean
  /** Render as dark silhouette (for locked achievements — hints at the trophy shape). */
  silhouette?: boolean
  /** Enable tap-to-celebrate (only when NOT nested inside a button). */
  interactive?: boolean
}) {
  const uid = useId().replace(/[:]/g, '')
  const finalPx = px ?? SIZE_PX[size]
  const glyphPx = Math.round(finalPx * GLYPH_FRACTION[shape])
  const glyphOffsetY = Math.round(finalPx * GLYPH_OFFSET_FRACTION[shape])
  const stops = GRADIENT_STOPS[tier]
  const gradId = `sr-trophy-${tier}-${uid}`
  const shineId = `sr-trophy-shine-${uid}`
  const glowId = `sr-trophy-glow-${uid}`
  const haloId = `sr-trophy-halo-${uid}`
  const silhouetteFill = 'var(--sr-text-muted)'
  const hasGlow = (tier === 'diamond' || tier === 'gold') && !silhouette
  const isDiamond = tier === 'diamond' && !silhouette

  // Auto-pause animations when trophy is off-screen (performance)
  const containerRef = useRef<HTMLSpanElement>(null)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    if (!containerRef.current || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '100px' },
    )
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  // Tap-to-celebrate — triggers shine sweep + sparkle burst
  const [celebrating, setCelebrating] = useState(false)
  const celebrateTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleTap = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (!interactive || silhouette || !hasGlow) return
    e?.stopPropagation()
    setCelebrating(true)
    if (celebrateTimer.current) clearTimeout(celebrateTimer.current)
    celebrateTimer.current = setTimeout(() => setCelebrating(false), 1200)
  }
  useEffect(() => () => { if (celebrateTimer.current) clearTimeout(celebrateTimer.current) }, [])

  return (
    <span
      ref={containerRef}
      className={cn(
        'sr-trophy',
        `sr-trophy--${tier}`,
        `sr-trophy--${shape}`,
        silhouette && 'sr-trophy--silhouette',
        !inView && 'sr-trophy--paused',
        celebrating && 'sr-trophy--celebrating',
        interactive && 'sr-trophy--interactive',
        'relative inline-flex items-center justify-center',
        className,
      )}
      style={{ width: finalPx, height: finalPx }}
      aria-hidden={ariaHidden}
      role={ariaHidden ? undefined : (interactive ? 'button' : 'img')}
      tabIndex={interactive && !ariaHidden ? 0 : undefined}
      onClick={interactive ? handleTap : undefined}
      onKeyDown={interactive && !ariaHidden ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleTap()
        }
      } : undefined}
    >
      <svg
        width={finalPx}
        height={finalPx}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        fill="none"
        className="absolute inset-0 overflow-visible"
      >
        <defs>
          {/* Static SVG glow filter — glow color/opacity animated via CSS drop-shadow on SVG element */}
          {hasGlow && (
            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceAlpha" stdDeviation={tier === 'diamond' ? 2.5 : 1.5} result="blur" />
              <feFlood floodColor={tier === 'diamond' ? '#a78bfa' : '#fbbf24'} floodOpacity={tier === 'diamond' ? 0.55 : 0.35} result="color" />
              <feComposite in="color" in2="blur" operator="in" result="glow" />
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          <linearGradient id={gradId} x1="6" y1="2" x2="42" y2="46" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={silhouette ? silhouetteFill : stops.hi} />
            <stop offset="45%" stopColor={silhouette ? silhouetteFill : stops.mid} />
            <stop offset="100%" stopColor={silhouette ? silhouetteFill : stops.lo} />
          </linearGradient>
          <linearGradient id={shineId} x1="10" y1="4" x2="24" y2="22" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={silhouette ? 'transparent' : '#ffffff'} stopOpacity={silhouette ? 0 : 0.55} />
            <stop offset="60%" stopColor={silhouette ? 'transparent' : '#ffffff'} stopOpacity={silhouette ? 0 : 0.12} />
            <stop offset="100%" stopColor={silhouette ? 'transparent' : '#ffffff'} stopOpacity={0} />
          </linearGradient>
          {/* Prism gradient — rainbow refraction for diamond tier */}
          <linearGradient id={`${gradId}-prism`} x1="0" y1="0" x2={VIEWBOX} y2={VIEWBOX} gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff6b9d" stopOpacity={0.5} />
            <stop offset="25%" stopColor="#c084fc" stopOpacity={0.5} />
            <stop offset="50%" stopColor="#60a5fa" stopOpacity={0.5} />
            <stop offset="75%" stopColor="#34d399" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity={0.5} />
          </linearGradient>
          {/* Radial halo gradient — soft glow behind diamond trophies */}
          {isDiamond && (
            <radialGradient id={haloId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.25} />
              <stop offset="60%" stopColor="#a78bfa" stopOpacity={0.08} />
              <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
            </radialGradient>
          )}
        </defs>

        {/* Glow halo — soft radial gradient behind diamond trophies */}
        {isDiamond && (
          <circle cx={VIEWBOX / 2} cy={VIEWBOX / 2} r={VIEWBOX / 2} fill={`url(#${haloId})`} className="sr-trophy-halo" />
        )}

        <g filter={hasGlow ? `url(#${glowId})` : undefined} className={hasGlow ? 'sr-trophy-glow-group' : undefined}>
        {shape === 'medal' && <MedalShape gradId={gradId} shineId={shineId} silhouette={silhouette} tier={tier} />}
        {shape === 'shield' && <ShieldShape gradId={gradId} shineId={shineId} silhouette={silhouette} tier={tier} />}
        {shape === 'cup' && <CupShape gradId={gradId} shineId={shineId} silhouette={silhouette} tier={tier} />}
        {shape === 'crown' && <CrownShape gradId={gradId} shineId={shineId} silhouette={silhouette} tier={tier} />}
        {shape === 'diamond' && <DiamondShape gradId={gradId} shineId={shineId} silhouette={silhouette} tier={tier} />}
        </g>

        {/* Glyph medalion — subtle circular backdrop for the achievement icon */}
        {glyph && !silhouette && (
          <circle
            cx={VIEWBOX / 2}
            cy={VIEWBOX / 2 + GLYPH_OFFSET_FRACTION[shape] * VIEWBOX}
            r={GLYPH_FRACTION[shape] * VIEWBOX * 0.72}
            fill={GRADIENT_STOPS[tier].hi}
            opacity="0.25"
            className="sr-trophy-medalion"
          />
        )}

        {/* Epic sparkles — rendered for ALL shapes when tier is diamond */}
        {tier === 'diamond' && !silhouette && (
          <g className="sr-trophy-sparkles">
            {/* 4-point sparkle stars — within viewBox, big enough to see */}
            <path d="M6 6 L7.5 9 L6 12 L4.5 9 Z" fill="#ffffff" />
            <path d="M42 6 L43.5 9 L42 12 L40.5 9 Z" fill="#ffffff" />
            <path d="M6 42 L7 44 L6 46 L5 44 Z" fill="#ffffff" />
            <path d="M42 42 L43 44 L42 46 L41 44 Z" fill="#ffffff" />
            {/* Medium stars at edge midpoints */}
            <path d="M24 3 L25 6 L24 9 L23 6 Z" fill="#ffffff" />
            <path d="M45 24 L42 23 L45 22 L48 23 Z" fill="#ffffff" />
            <path d="M24 45 L25 42 L24 39 L23 42 Z" fill="#ffffff" />
            <path d="M3 24 L6 23 L3 22 L0 23 Z" fill="#ffffff" />
            {/* Small twinkle dots */}
            <circle cx="14" cy="14" r="1.2" fill="#ffffff" />
            <circle cx="34" cy="14" r="1" fill="#ffffff" />
            <circle cx="14" cy="34" r="1" fill="#ffffff" />
            <circle cx="34" cy="34" r="0.8" fill="#ffffff" />
          </g>
        )}

        {/* Gold sparkles — warm glowing dots that pulse in place (no rotation, distinct from diamond) */}
        {tier === 'gold' && !silhouette && (
          <g className="sr-trophy-sparkles--gold">
            <circle cx="8" cy="8" r="1.8" fill="#fde68a" />
            <circle cx="40" cy="8" r="1.5" fill="#fde68a" />
            <circle cx="8" cy="40" r="1.3" fill="#fde68a" />
            <circle cx="40" cy="40" r="1.1" fill="#fde68a" />
            <circle cx="24" cy="5" r="1" fill="#fde68a" />
            <circle cx="24" cy="43" r="0.9" fill="#fde68a" />
          </g>
        )}
      </svg>

      {/* Glyph overlay — achievement's semantic icon on top of the trophy */}
      {glyph && !silhouette && (
        <span
          className="absolute z-10 flex items-center justify-center"
          style={{
            width: glyphPx,
            height: glyphPx,
            top: '50%',
            left: '50%',
            marginTop: -glyphPx / 2 + glyphOffsetY,
            marginLeft: -glyphPx / 2,
            color: GLYPH_COLOR[tier],
            filter: tier === 'diamond' ? 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' : 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))',
          }}
        >
          {glyph}
        </span>
      )}
    </span>
  )
}

/* ── Shapes ── */

type ShapeProps = { gradId: string; shineId: string; silhouette?: boolean; tier: TrophyTier }

function MedalShape({ gradId, shineId, silhouette, tier }: ShapeProps) {
  const stroke = silhouette ? 'none' : GRADIENT_STOPS[tier].lo
  return (
    <g>
      {/* Ribbon — top, wider */}
      <path
        d="M14 2 L22 18 L14 18 L6 2 Z"
        fill={silhouette ? `url(#${gradId})` : 'var(--sr-brand-primary)'}
        opacity={silhouette ? 0.5 : 0.85}
      />
      <path
        d="M34 2 L26 18 L34 18 L42 2 Z"
        fill={silhouette ? `url(#${gradId})` : 'var(--sr-brand-secondary)'}
        opacity={silhouette ? 0.5 : 0.85}
      />
      {/* Medal body — large, fills width */}
      <circle cx="24" cy="30" r="17" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="1" />
      {!silhouette && (
        <>
          {/* Inner ring */}
          <circle cx="24" cy="30" r="12.5" fill="none" stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.6" opacity="0.4" />
          {/* Shine */}
          <ellipse cx="17" cy="23" rx="8" ry="6" fill={`url(#${shineId})`} />
        </>
      )}
    </g>
  )
}

function ShieldShape({ gradId, shineId, silhouette, tier }: ShapeProps) {
  const stroke = silhouette ? 'none' : GRADIENT_STOPS[tier].lo
  return (
    <g>
      {/* Shield body — fills viewBox edge to edge */}
      <path
        d="M24 2 L44 8 V24 C44 35 35 43 24 46 C13 43 4 35 4 24 V8 Z"
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth="1"
      />
      {!silhouette && (
        <>
          {/* Inner border */}
          <path
            d="M24 6 L40 10.5 V24 C40 32 33 39 24 41.5 C15 39 8 32 8 24 V10.5 Z"
            fill="none"
            stroke={GRADIENT_STOPS[tier].lo}
            strokeWidth="0.5"
            opacity="0.4"
          />
          {/* Shine */}
          <path
            d="M24 2 L44 8 V24 C44 28 42 32 39 35 L24 6 Z"
            fill={`url(#${shineId})`}
            opacity="0.6"
          />
        </>
      )}
    </g>
  )
}

function CupShape({ gradId, shineId, silhouette, tier }: ShapeProps) {
  const stroke = silhouette ? 'none' : GRADIENT_STOPS[tier].lo
  return (
    <g>
      {/* Left handle — wider */}
      <path
        d="M5 11 C-1 11 -1 25 5 27 L11 23 C8 22 8 16 11 14 Z"
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth="0.6"
      />
      {/* Right handle — wider */}
      <path
        d="M43 11 C49 11 49 25 43 27 L37 23 C40 22 40 16 37 14 Z"
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth="0.6"
      />
      {/* Cup bowl — wide, fills viewBox */}
      <path
        d="M6 5 H42 V19 C42 28 34 34 24 34 C14 34 6 28 6 19 Z"
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth="1"
      />
      {/* Stem */}
      <rect x="20" y="34" width="8" height="8" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.5" />
      {/* Base — wide */}
      <path
        d="M8 42 H40 L38 46 H10 Z"
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth="0.8"
      />
      {!silhouette && (
        <>
          {/* Rim highlight */}
          <ellipse cx="24" cy="6" rx="16" ry="2.5" fill={GRADIENT_STOPS[tier].hi} opacity="0.7" />
          {/* Base highlight */}
          <rect x="13" y="43" width="22" height="1.5" fill={GRADIENT_STOPS[tier].hi} opacity="0.6" />
          {/* Shine */}
          <path d="M8 5 L19 5 L15 29 L8 23 Z" fill={`url(#${shineId})`} />
        </>
      )}
    </g>
  )
}

function CrownShape({ gradId, shineId, silhouette, tier }: ShapeProps) {
  const stroke = silhouette ? 'none' : GRADIENT_STOPS[tier].lo
  return (
    <g>
      {/* Base band — wide, taller for glyph space */}
      <path
        d="M4 30 H44 V44 H4 Z"
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth="0.8"
      />
      {/* Crown peaks — 5 points, shorter for more body space */}
      <path
        d="M4 30 L8 14 L15 26 L20 6 L24 22 L28 6 L33 26 L40 14 L44 30 Z"
        fill={`url(#${gradId})`}
        stroke={stroke}
        strokeWidth="1"
        strokeLinejoin="round"
      />
      {!silhouette && (
        <>
          {/* Jewels on peaks */}
          <circle cx="8" cy="14" r="1.8" fill={GRADIENT_STOPS[tier].hi} stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.3" />
          <circle cx="20" cy="6" r="2.2" fill={GRADIENT_STOPS[tier].hi} stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.4" />
          <circle cx="28" cy="6" r="2.2" fill={GRADIENT_STOPS[tier].hi} stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.4" />
          <circle cx="40" cy="14" r="1.8" fill={GRADIENT_STOPS[tier].hi} stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.3" />
          {/* Center decorative gem on body */}
          <circle cx="24" cy="36" r="2" fill={GRADIENT_STOPS[tier].hi} stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.3" opacity="0.7" />
          {/* Band highlight */}
          <rect x="6" y="31" width="36" height="1.5" fill={GRADIENT_STOPS[tier].hi} opacity="0.6" />
          {/* Lower band highlight */}
          <rect x="6" y="41" width="36" height="1" fill={GRADIENT_STOPS[tier].hi} opacity="0.4" />
          {/* Shine on left face */}
          <path d="M4 30 L8 14 L12 18 L7 30 Z" fill={`url(#${shineId})`} opacity="0.5" />
        </>
      )}
    </g>
  )
}

function DiamondShape({ gradId, shineId, silhouette, tier }: ShapeProps) {
  const stroke = silhouette ? 'none' : GRADIENT_STOPS[tier].lo
  const prismId = `${gradId}-prism`
  return (
    <g>
      {/* Top table facet — wide */}
      <path d="M4 15 L24 2 L44 15 L38 19 L24 11 L10 19 Z" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.6" />
      {/* Crown — upper facets, wider */}
      <path d="M10 19 L24 11 L38 19 L41 25 L24 21 L7 25 Z" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.5" />
      {/* Pavilion — large bottom point, fills viewBox */}
      <path d="M7 25 L24 21 L41 25 L24 46 Z" fill={`url(#${gradId})`} stroke={stroke} strokeWidth="0.8" />
      {!silhouette && (
        <>
          {/* Prism overlay — animated rainbow refraction */}
          <path d="M7 25 L24 21 L41 25 L24 46 Z" fill={`url(#${prismId})`} className="sr-trophy-prism" />
          {/* Facet lines — richer inner geometry */}
          <path d="M7 25 L24 31 L41 25" fill="none" stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.5" opacity="0.5" />
          <path d="M14 19 L24 31 L34 19" fill="none" stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.4" opacity="0.35" />
          <path d="M24 31 L24 46" fill="none" stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.4" opacity="0.3" />
          {/* Additional facet lines — more geometric detail */}
          <path d="M10 19 L17 25 L24 19" fill="none" stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.3" opacity="0.25" />
          <path d="M38 19 L31 25 L24 19" fill="none" stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.3" opacity="0.25" />
          <path d="M17 25 L24 31 L31 25" fill="none" stroke={GRADIENT_STOPS[tier].lo} strokeWidth="0.3" opacity="0.2" />
          {/* Sparkle highlights — brighter and more */}
          <circle cx="14" cy="16" r="1.5" fill="#ffffff" opacity="0.9" />
          <circle cx="33" cy="22" r="1.2" fill="#ffffff" opacity="0.7" />
          <circle cx="24" cy="40" r="1" fill="#ffffff" opacity="0.6" />
          <circle cx="20" cy="28" r="0.6" fill="#ffffff" opacity="0.5" />
          {/* Cross sparkle on table facet */}
          <path d="M24 6 L24 14 M20 10 L28 10" stroke="#ffffff" strokeWidth="0.4" opacity="0.6" strokeLinecap="round" />
          {/* Shine sweep */}
          <path d="M4 15 L24 2 L30 7 L10 19 Z" fill={`url(#${shineId})`} />
        </>
      )}
    </g>
  )
}
