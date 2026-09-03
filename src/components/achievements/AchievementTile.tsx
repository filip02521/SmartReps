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
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AchievementDef, AchievementRarity } from '@/lib/achievements/types'
import { achievementTitle } from '@/lib/achievements/copy'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'

const GLYPHS: Record<string, LucideIcon> = {
  dumbbell: Dumbbell,
  target: Target,
  list: ListChecks,
  flag: Flag,
  pull: TrendingUp,
  wrench: Wrench,
  trending: TrendingUp,
  hundred: Target,
  pull50: TrendingUp,
  layers: Layers,
  calendar: Calendar,
  flame: Flame,
  crown: Crown,
  refresh: RefreshCw,
  upload: Upload,
  heart: Heart,
  download: Download,
  users: Users,
  footprints: Footprints,
  library: Library,
  logo: Shield,
  shield: Shield,
  moon: Moon,
  crosshair: Crosshair,
}

function rarityOuter(
  rarity: AchievementRarity,
  unlocked: boolean,
): { className: string; style?: CSSProperties } {
  if (!unlocked) return { className: 'bg-[var(--sr-border-subtle)]' }
  if (rarity === 'legendary') {
    return {
      className: '',
      style: { backgroundImage: 'var(--sr-brand-gradient)' },
    }
  }
  if (rarity === 'rare') {
    return {
      className: 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_55%,transparent)]',
    }
  }
  return { className: 'bg-[var(--sr-border-subtle)]' }
}

function rarityInner(rarity: AchievementRarity, unlocked: boolean): string {
  if (!unlocked) return 'bg-[var(--sr-bg-elevated)]'
  if (rarity === 'rare' || rarity === 'legendary') {
    return 'bg-[var(--sr-brand-primary-muted)]'
  }
  return 'bg-[var(--sr-bg-elevated)]'
}

export function AchievementTile({
  def,
  unlocked,
  size = 'md',
  highlight,
  onClick,
  pulse,
  showCaption,
}: {
  def: AchievementDef
  unlocked: boolean
  size?: 'sm' | 'md' | 'lg'
  highlight?: boolean
  onClick?: () => void
  /** One-shot legendary pulse (~600ms), not a loop. */
  pulse?: boolean
  /** Override caption visibility (default: hidden for sm). */
  showCaption?: boolean
}) {
  const secretLocked = Boolean(def.isSecret && !unlocked)
  const Icon = secretLocked ? HelpCircle : (GLYPHS[def.glyph] ?? HelpCircle)
  const dim =
    size === 'lg' ? 'h-28 w-28' : size === 'sm' ? 'h-12 w-12' : 'h-[4.5rem] w-[4.5rem]'
  const iconSize = size === 'lg' ? 36 : size === 'sm' ? 20 : 28
  const title = secretLocked ? pl.achievementsSecretLocked : achievementTitle(def.id)
  const caption = showCaption ?? size !== 'sm'
  const ring = size === 'lg' ? 'p-[2.5px]' : 'p-[2px]'
  const outer = rarityOuter(def.rarity, unlocked)

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
          unlocked && def.rarity === 'legendary' && 'shadow-[var(--sr-shadow-glow)]',
          unlocked && def.rarity === 'rare' && 'shadow-[var(--sr-shadow-glow)]',
          !unlocked && 'opacity-40',
          highlight && 'ring-2 ring-[var(--sr-brand-primary)] ring-offset-2 ring-offset-[var(--sr-bg-base)]',
          pulse && unlocked && def.rarity === 'legendary' && 'sr-ach-pulse',
        )}
        style={outer.style}
      >
        <span
          className={cn(
            'flex items-center justify-center rounded-[calc(var(--sr-radius-lg)-2px)]',
            dim,
            rarityInner(def.rarity, unlocked),
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
      </span>
      {caption && (
        <span className="max-w-[5.5rem] sr-text-caption text-[var(--sr-text-secondary)] line-clamp-2">
          {title}
        </span>
      )}
    </button>
  )
}
