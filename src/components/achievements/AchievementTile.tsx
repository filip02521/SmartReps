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

/** Visual tier level — determines glow intensity and ring treatment. */
type TierVisual = 'none' | 'bronze' | 'silver' | 'gold' | 'diamond'

function tierVisual(rarity: AchievementRarity, tierLevel: number | null | undefined): TierVisual {
  if (!tierLevel || tierLevel <= 0) return 'none'
  // Diamond = highest tier in any multi-tier achievement
  if (tierLevel >= 4) return 'diamond'
  if (tierLevel === 3) return 'gold'
  if (tierLevel === 2) return rarity === 'legendary' ? 'gold' : 'silver'
  return 'bronze'
}

function rarityOuter(
  rarity: AchievementRarity,
  unlocked: boolean,
  tierLevel: number | null | undefined,
): { className: string; style?: CSSProperties } {
  if (!unlocked) return { className: 'bg-[var(--sr-border-subtle)]' }
  const tv = tierVisual(rarity, tierLevel)
  // Diamond tier: full gradient + strong glow
  if (tv === 'diamond') {
    return {
      className: 'sr-ach-diamond',
      style: { backgroundImage: 'var(--sr-brand-gradient)' },
    }
  }
  // Gold tier: gradient
  if (tv === 'gold' || rarity === 'legendary') {
    return {
      className: '',
      style: { backgroundImage: 'var(--sr-brand-gradient)' },
    }
  }
  // Silver tier: stronger brand mix
  if (tv === 'silver') {
    return {
      className: 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_75%,transparent)]',
    }
  }
  // Bronze / rare
  if (rarity === 'rare') {
    return {
      className: 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_55%,transparent)]',
    }
  }
  return { className: 'bg-[var(--sr-border-subtle)]' }
}

function rarityInner(
  rarity: AchievementRarity,
  unlocked: boolean,
  tierLevel: number | null | undefined,
): string {
  if (!unlocked) return 'bg-[var(--sr-bg-elevated)]'
  const tv = tierVisual(rarity, tierLevel)
  if (tv === 'diamond' || tv === 'gold') return 'bg-[var(--sr-brand-primary-muted)]'
  if (tv === 'silver') return 'bg-[var(--sr-brand-primary-muted)]'
  if (rarity === 'rare' || rarity === 'legendary') {
    return 'bg-[var(--sr-brand-primary-muted)]'
  }
  return 'bg-[var(--sr-bg-elevated)]'
}

function glowClass(
  rarity: AchievementRarity,
  unlocked: boolean,
  tierLevel: number | null | undefined,
): string {
  if (!unlocked) return ''
  const tv = tierVisual(rarity, tierLevel)
  if (tv === 'diamond') return 'shadow-[0_0_28px_var(--sr-brand-primary-muted)]'
  if (tv === 'gold') return 'shadow-[var(--sr-shadow-glow)]'
  if (rarity === 'legendary' || rarity === 'rare') return 'shadow-[var(--sr-shadow-glow)]'
  return ''
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
  const ring = size === 'lg' ? 'p-[2.5px]' : 'p-[2px]'
  const displayRarity = unlocked
    ? resolveDisplayRarity(def, null, tierLevel)
    : // For locked tiered: show first tier rarity (the one user is working toward)
      def.tiers?.[0]?.rarity ?? def.rarity
  const outer = rarityOuter(displayRarity, unlocked, tierLevel)
  const glow = glowClass(displayRarity, unlocked, tierLevel)
  const hasTiers = Boolean(def.tiers && def.tiers.length > 0)
  const maxTier = def.tiers?.length ?? 0

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      className={cn(
        FOCUS_RING,
        'flex flex-col items-center gap-1.5 rounded-[var(--sr-radius-md)] text-center',
        onClick && 'cursor-pointer',
      )}
    >
      <span
        className={cn(
          'relative rounded-[var(--sr-radius-lg)]',
          ring,
          outer.className,
          glow,
          !unlocked && 'opacity-40',
          highlight && 'ring-2 ring-[var(--sr-brand-primary)] ring-offset-2 ring-offset-[var(--sr-bg-base)]',
          pulse && unlocked && (tierLevel ?? 0) >= maxTier && maxTier > 1 && 'sr-ach-pulse',
          pulse && unlocked && maxTier <= 1 && displayRarity === 'legendary' && 'sr-ach-pulse',
        )}
        style={outer.style}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-[calc(var(--sr-radius-lg)-2px)]',
            dim,
            rarityInner(displayRarity, unlocked, tierLevel),
          )}
        >
          <Icon
            size={iconSize}
            strokeWidth={1.75}
            className={cn(
              unlocked ? 'text-[var(--sr-text-primary)]' : 'text-[var(--sr-text-muted)]',
            )}
            aria-hidden
          />
        </span>
        {/* Tier pips — small dots showing progress through tiers */}
        {hasTiers && unlocked && maxTier > 1 && size !== 'sm' && (
          <span
            className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1 rounded-full bg-[var(--sr-bg-base)] px-1 py-0.5"
            aria-hidden
          >
            {Array.from({ length: maxTier }, (_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  i < (tierLevel ?? 0)
                    ? 'bg-[var(--sr-brand-primary)]'
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
