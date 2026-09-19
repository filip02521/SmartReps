import type { CSSProperties } from 'react'
import { Flame, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Streak epic-ness tiers anchored on STREAK_MILESTONES (weeks):
 *  0 unlit · 1 lit (1–3) · 2 kindled (4–7) · 3 burning (8–11)
 *  4 blazing (12–25) · 5 inferno (26–51) · 6 legendary (52+) */
export function streakFlameTier(weeks: number): number {
  if (weeks <= 0) return 0
  if (weeks < 4) return 1
  if (weeks < 8) return 2
  if (weeks < 12) return 3
  if (weeks < 26) return 4
  if (weeks < 52) return 5
  return 6
}

// Fire ramp: ember amber → orange → red-hot → legendary gold.
// Built from warning/error tokens via color-mix — no hardcoded hex.
const TIER_COLOR = [
  'var(--sr-text-muted)',
  // Freshly lit — ember: amber slightly desaturated toward muted text.
  'color-mix(in srgb, var(--sr-warning) 85%, var(--sr-text-muted))',
  'color-mix(in srgb, var(--sr-warning) 75%, var(--sr-error))',
  'color-mix(in srgb, var(--sr-warning) 50%, var(--sr-error))',
  'color-mix(in srgb, var(--sr-warning) 25%, var(--sr-error))',
  'color-mix(in srgb, var(--sr-error) 80%, var(--sr-warning))',
  // Legendary — gold pushed toward the foreground color: bright in dark
  // mode, deeper in light mode. Reads richer than plain warning amber.
  'color-mix(in srgb, var(--sr-warning) 80%, var(--sr-text-primary))',
] as const

// Glow grows with the tier — drop-shadow uses the flame color so the
// aura matches the current heat level.
const TIER_GLOW = [
  undefined,
  undefined,
  undefined,
  `drop-shadow(0 0 4px ${TIER_COLOR[3]})`,
  `drop-shadow(0 0 6px ${TIER_COLOR[4]}) drop-shadow(0 0 2px ${TIER_COLOR[2]})`,
  `drop-shadow(0 0 8px ${TIER_COLOR[5]}) drop-shadow(0 0 3px var(--sr-warning))`,
  `drop-shadow(0 0 10px var(--sr-warning)) drop-shadow(0 0 4px var(--sr-warning))`,
] as const

const TIER_ANIM = [
  undefined,
  undefined,
  'sr-flame-pulse',
  'sr-flame-pulse',
  'sr-flame-pulse-fast',
  'sr-flame-flicker',
  'sr-flame-flicker',
] as const

export function streakFlameColor(weeks: number): string {
  return TIER_COLOR[streakFlameTier(weeks)]
}

/** Badge/container style matching the flame tier — tinted bg + flame color.
 *  Returns undefined for tier 0 (unlit) so callers keep their neutral look. */
export function streakFlameBadgeStyle(weeks: number): CSSProperties | undefined {
  const tier = streakFlameTier(weeks)
  if (tier === 0) return undefined
  const color = TIER_COLOR[tier]
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${tier >= 5 ? 20 : 15}%, transparent)`,
    color,
  }
}

/** The single streak flame icon — progressively more epic as the streak
 *  grows: color ramps amber → orange → red-hot → gold, glow and animation
 *  intensify per tier. All surfaces (top-bar chip, activity card, detail
 *  sheet, heatmap, celebration) should use this instead of a bare Flame. */
export function StreakFlame({
  streak,
  size = 16,
  strokeWidth = 2,
  sparkle = false,
  embers = false,
  dying = false,
  burst = false,
  className,
}: {
  streak: number
  size?: number
  strokeWidth?: number
  /** t6-only extra flourish — tiny sparkles badge. Use on hero surfaces;
   *  too noisy on small chips. */
  sparkle?: boolean
  /** Floating ember particles rising off the flame (tier ≥4). Hero
   *  surfaces only — too noisy on compact rows/chips. */
  embers?: boolean
  /** At-risk streak — the flame is literally going out: desaturated
   *  color + erratic dying flicker, no glow. Pure loss-aversion cue. */
  dying?: boolean
  /** One-shot ignite entrance (scale burst) on a wrapper — the ongoing
   *  tier animation keeps running on the icon itself. For celebration
   *  moments (recap card, overlay badge). */
  burst?: boolean
  className?: string
}) {
  const tier = streakFlameTier(streak)
  const color =
    dying && tier > 0
      ? `color-mix(in srgb, ${TIER_COLOR[tier]} 50%, var(--sr-text-muted))`
      : TIER_COLOR[tier]
  const icon = (
    <Flame
      size={size}
      strokeWidth={strokeWidth}
      className={cn(dying ? 'sr-flame-dying' : TIER_ANIM[tier], className)}
      style={{ color, filter: dying ? undefined : TIER_GLOW[tier] }}
      aria-hidden
    />
  )
  const decorated =
    (sparkle && tier >= 6 && !dying) || (embers && tier >= 4 && !dying)
  const inner = decorated ? (
    <span className="relative inline-flex" aria-hidden>
      {icon}
      {embers &&
        tier >= 4 &&
        !dying &&
        [0, 1, 2].map((i) => (
          <i
            key={i}
            className="sr-ember"
            style={
              {
                width: Math.max(2, Math.round(size * 0.14)),
                height: Math.max(2, Math.round(size * 0.14)),
                left: `${30 + i * 22}%`,
                top: '15%',
                backgroundColor: color,
                animationDelay: `${i * 0.55}s`,
                '--ember-drift': `${i % 2 === 0 ? -3 : 3}px`,
              } as CSSProperties
            }
          />
        ))}
      {sparkle && tier >= 6 && !dying && (
        <Sparkles
          size={Math.max(10, Math.round(size * 0.45))}
          strokeWidth={2.5}
          className="sr-flame-pulse-fast absolute -right-1.5 -top-1.5"
          style={{ color: 'var(--sr-warning)' }}
        />
      )}
    </span>
  ) : (
    icon
  )
  if (!burst) return inner
  return (
    <span className="sr-flame-ignite inline-flex" aria-hidden>
      {inner}
    </span>
  )
}
