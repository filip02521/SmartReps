import { useMemo } from 'react'
import { ACHIEVEMENT_CATALOG, ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import { trophyTierFor, type TrophyTier } from '@/lib/achievements/trophy-tier'
import { trophyMaterialLabelPlural } from '@/lib/achievements/copy'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

const TIER_ORDER: TrophyTier[] = ['diamond', 'gold', 'silver']

const TIER_COLOR: Record<TrophyTier, string> = {
  diamond: '#a78bfa',
  gold: '#fbbf24',
  silver: '#c0c8d4',
  bronze: '#b87333',
}

/** Total achievements that can reach diamond tier (4+ tiers). */
const DIAMOND_MAX = ACHIEVEMENT_CATALOG.filter((def) => def.tiers && def.tiers.length >= 4).length

/**
 * Compact summary bar showing trophy counts per material.
 * e.g. "2 diamentowe, 3 złote, 1 srebrna"
 * Rendered above the achievement gallery.
 */
export function TrophySummaryBar({ unlocks }: { unlocks: LocalAchievementUnlock[] }) {
  const counts = useMemo(() => {
    const map = new Map<TrophyTier, number>()
    for (const u of unlocks) {
      const def = ACHIEVEMENT_BY_ID[u.id]
      if (!def) continue
      const tier = trophyTierFor(def, true, u.tierLevel)
      if (!tier) continue
      map.set(tier, (map.get(tier) ?? 0) + 1)
    }
    return map
  }, [unlocks])

  const parts = TIER_ORDER.filter((t) => counts.has(t))
  const diamondCount = counts.get('diamond') ?? 0
  const diamondPct = DIAMOND_MAX > 0 ? Math.min(100, Math.round((diamondCount / DIAMOND_MAX) * 100)) : 0

  if (parts.length === 0) return null

  const summaryText = parts
    .map((t) => `${counts.get(t)} ${trophyMaterialLabelPlural(t)}`)
    .join(', ')

  return (
    <div
      className="flex flex-col gap-3 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] p-3"
      role="status"
      aria-label={pl.achievementsTrophySummary(summaryText)}
    >
      <div className="flex flex-wrap items-center gap-3">
        {parts.map((tier) => (
          <div key={tier} className="flex items-center gap-1.5">
            <span
              className={cn('h-2.5 w-2.5 rounded-full')}
              style={{ backgroundColor: TIER_COLOR[tier] }}
              aria-hidden
            />
            <span className="sr-text-caption font-medium text-[var(--sr-text-secondary)]">
              {counts.get(tier)} {trophyMaterialLabelPlural(tier)}
            </span>
          </div>
        ))}
      </div>
      {/* Diamond collection progress — motivates collecting all diamond trophies */}
      {DIAMOND_MAX > 0 && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between sr-text-caption text-[var(--sr-text-muted)]">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TIER_COLOR.diamond }} aria-hidden />
              {pl.achievementsDiamondProgress}
            </span>
            <span className="tabular-nums">{diamondCount}/{DIAMOND_MAX}</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-muted)]"
            role="progressbar"
            aria-label={pl.achievementsDiamondProgress}
            aria-valuenow={diamondCount}
            aria-valuemin={0}
            aria-valuemax={DIAMOND_MAX}
            aria-valuetext={`${diamondCount} / ${DIAMOND_MAX}`}
          >
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{
                width: `${diamondPct}%`,
                background: 'linear-gradient(90deg, var(--sr-trophy-diamond, #a78bfa), var(--sr-trophy-diamond-light, #c084fc))',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
