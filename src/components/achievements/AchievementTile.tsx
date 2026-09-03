import type { CSSProperties } from 'react'
import {
  Dumbbell,
  Target,
  ListChecks,
  Flag,
  Wrench,
  TrendingUp,
  Layers,
  Calendar,
  Flame,
  Crown,
  RefreshCw,
  Upload,
  Heart,
  Download,
  Users,
  Footprints,
  Library,
  Shield,
  Moon,
  Crosshair,
  HelpCircle,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AchievementDef, AchievementRarity } from '@/lib/achievements/types'
import { achievementTitle } from '@/lib/achievements/copy'
import { resolveDisplayGlyph, resolveDisplayRarity } from '@/lib/achievements/catalog'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'

export const GLYPHS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  target: Target,
  list: ListChecks,
  flag: Flag,
  pull: TrendingUp,
  wrench: Wrench,
  trending: TrendingUp,
  hundred: Target,
  'hundred-gold': Target,
  pull50: TrendingUp,
  'pull50-gold': TrendingUp,
  layers: Layers,
  'layers-gold': Layers,
  'layers-diamond': Layers,
  calendar: Calendar,
  flame: Flame,
  crown: Crown,
  'crown-diamond': Crown,
  refresh: RefreshCw,
  upload: Upload,
  heart: Heart,
  download: Download,
  users: Users,
  'users-gold': Users,
  footprints: Footprints,
  library: Library,
  logo: Shield,
  shield: Shield,
  'shield-gold': Shield,
  moon: Moon,
  'moon-diamond': Moon,
  crosshair: Crosshair,
  'crosshair-diamond': Crosshair,
  'bar-chart': BarChart3,
  'bar-chart-gold': BarChart3,
  'bar-chart-diamond': BarChart3,
  'flag-diamond': Flag,
}

/** Visual tier level — determines ring, glow, and animation treatment. */
type TierVisual = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond'

function tierVisual(rarity: AchievementRarity, tierLevel: number | null | undefined): TierVisual {
  if (!tierLevel || tierLevel <= 0) return 'none'
  // Tier 1: use rarity-based visual (don't override with bronze)
  if (tierLevel === 1) return 'none'
  // Diamond = highest tier in any multi-tier achievement
  if (tierLevel >= 4) return 'diamond'
  if (tierLevel === 3) return 'gold'
  // Tier 2: silver for common/rare, gold for legendary
  return rarity === 'legendary' ? 'gold' : 'silver'
}

type VisualStyle = {
  /** Outer ring background (the gradient/solid behind the inner icon). */
  outerClass: string
  outerStyle?: CSSProperties
  /** Inner icon background. */
  innerClass: string
  /** Glow shadow class. */
  glowClass: string
  /** Animation class (legendary/diamond). */
  animClass: string
  /** Icon color override (for diamond/legendary). */
  iconClass: string
}

function resolveVisual(
  rarity: AchievementRarity,
  unlocked: boolean,
  tierLevel: number | null | undefined,
): VisualStyle {
  if (!unlocked) {
    return {
      outerClass: 'bg-[var(--sr-border-subtle)]',
      innerClass: 'bg-[var(--sr-bg-elevated)]',
      glowClass: '',
      animClass: '',
      iconClass: 'text-[var(--sr-text-muted)]',
    }
  }

  const tv = tierVisual(rarity, tierLevel)
  const base = {
    iconClass: 'text-[var(--sr-text-primary)]',
    animClass: '',
  }

  // Diamond tier — animated gradient ring + shimmer glow (animation handles glow)
  if (tv === 'diamond') {
    return {
      ...base,
      outerClass: 'sr-ach-ring-diamond',
      innerClass: 'bg-[var(--sr-brand-primary-muted)]',
      glowClass: '',
      animClass: 'sr-ach-anim-diamond',
      iconClass: 'text-[var(--sr-text-primary)]',
    }
  }

  // Gold tier — gradient ring + warm pulse (animation handles glow)
  if (tv === 'gold') {
    return {
      ...base,
      outerClass: 'sr-ach-ring-gold',
      innerClass: 'bg-[var(--sr-brand-primary-muted)]',
      glowClass: '',
      animClass: 'sr-ach-anim-gold',
      iconClass: 'text-[var(--sr-text-primary)]',
    }
  }

  // Legendary (non-tiered or tier 1) — gradient ring + slow breathing (animation handles glow)
  if (rarity === 'legendary' && tv === 'none') {
    return {
      ...base,
      outerClass: 'sr-ach-ring-legendary',
      innerClass: 'bg-[var(--sr-brand-primary-muted)]',
      glowClass: '',
      animClass: 'sr-ach-anim-legendary',
      iconClass: 'text-[var(--sr-text-primary)]',
    }
  }

  // Silver tier — solid brand ring + subtle glow
  if (tv === 'silver') {
    return {
      ...base,
      outerClass: 'sr-ach-ring-silver',
      innerClass: 'bg-[var(--sr-brand-primary-muted)]',
      glowClass: 'sr-ach-glow-silver',
      animClass: '',
      iconClass: 'text-[var(--sr-text-primary)]',
    }
  }

  // Bronze tier — subtle brand ring, no glow
  if (tv === 'bronze') {
    return {
      ...base,
      outerClass: 'sr-ach-ring-bronze',
      innerClass: 'bg-[var(--sr-bg-elevated)]',
      glowClass: '',
      animClass: '',
      iconClass: 'text-[var(--sr-text-primary)]',
    }
  }

  // Rare (non-tiered) — brand-tinted ring + subtle glow
  if (rarity === 'rare') {
    return {
      ...base,
      outerClass: 'sr-ach-ring-rare',
      innerClass: 'bg-[var(--sr-bg-elevated)]',
      glowClass: 'sr-ach-glow-rare',
      animClass: '',
      iconClass: 'text-[var(--sr-text-primary)]',
    }
  }

  // Common — neutral, no glow
  return {
    ...base,
    outerClass: 'bg-[var(--sr-border-subtle)]',
    innerClass: 'bg-[var(--sr-bg-elevated)]',
    glowClass: '',
    animClass: '',
    iconClass: 'text-[var(--sr-text-primary)]',
  }
}

export function AchievementTile({
  def,
  unlocked,
  tierLevel,
  size = 'md',
  highlight,
  onClick,
  pulse,
  showCaption,
}: {
  def: AchievementDef
  unlocked: boolean
  /** Highest unlocked tier level (1-based). Null/0 for non-tiered or not-yet-tiered. */
  tierLevel?: number | null
  size?: 'sm' | 'md' | 'lg'
  highlight?: boolean
  onClick?: () => void
  /** One-shot legendary pulse (~600ms), not a loop. */
  pulse?: boolean
  /** Override caption visibility (default: hidden for sm). */
  showCaption?: boolean
}) {
  const secretLocked = Boolean(def.isSecret && !unlocked)
  const glyph = unlocked ? resolveDisplayGlyph(def, tierLevel) : def.glyph
  const Icon = secretLocked ? HelpCircle : (GLYPHS[glyph] ?? HelpCircle)
  const dim =
    size === 'lg' ? 'h-28 w-28' : size === 'sm' ? 'h-12 w-12' : 'h-[4.5rem] w-[4.5rem]'
  const iconSize = size === 'lg' ? 36 : size === 'sm' ? 20 : 28
  const title = secretLocked ? pl.achievementsSecretLocked : achievementTitle(def.id)
  const caption = showCaption ?? size !== 'sm'
  const ring = size === 'lg' ? 'p-[3px]' : 'p-[2px]'
  const displayRarity = unlocked
    ? resolveDisplayRarity(def, null, tierLevel)
    : // For locked tiered: show first tier rarity (the one user is working toward)
      def.tiers?.[0]?.rarity ?? def.rarity
  const vs = resolveVisual(displayRarity, unlocked, tierLevel)
  const hasTiers = Boolean(def.tiers && def.tiers.length > 0)
  const maxTier = def.tiers?.length ?? 0
  const isMaxTier = hasTiers && (tierLevel ?? 0) >= maxTier && maxTier > 1

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className={cn(
        FOCUS_RING,
        'flex flex-col items-center gap-1.5 rounded-[var(--sr-radius-md)] text-center transition-transform active:scale-95',
        onClick && 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'relative rounded-[var(--sr-radius-lg)]',
          ring,
          vs.outerClass,
          vs.glowClass,
          vs.animClass,
          !unlocked && 'opacity-40',
          highlight && 'ring-2 ring-[var(--sr-brand-primary)] ring-offset-2 ring-offset-[var(--sr-bg-base)]',
          // One-shot pulse on unlock for max-tier or legendary
          pulse && unlocked && (isMaxTier || (maxTier <= 1 && displayRarity === 'legendary')) && 'sr-ach-pulse',
        )}
        style={vs.outerStyle}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-[calc(var(--sr-radius-lg)-4px)]',
            dim,
            vs.innerClass,
          )}
        >
          <Icon
            size={iconSize}
            strokeWidth={1.75}
            className={vs.iconClass}
            aria-hidden
          />
        </span>
        {/* Tier pips — small dots showing progress through tiers (all sizes) */}
        {hasTiers && unlocked && maxTier > 1 && (
          <span
            className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-[var(--sr-bg-base)] px-1 py-0.5 shadow-sm"
            aria-hidden
          >
            {Array.from({ length: maxTier }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  i < (tierLevel ?? 0)
                    ? (tierLevel ?? 0) >= 4
                      ? 'bg-[var(--sr-brand-secondary)]'
                      : 'bg-[var(--sr-brand-primary)]'
                    : 'bg-[var(--sr-border-subtle)]',
                )}
              />
            ))}
          </span>
        )}
      </span>
      {caption && (
        <span className="max-w-[5.5rem] sr-text-caption text-[var(--sr-text-secondary)] line-clamp-2">
          {title}
        </span>
      )}
    </button>
  )
}
