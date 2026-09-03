import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import {
  ACHIEVEMENT_BY_ID,
  resolveDisplayRarity,
  resolveDisplayGlyph,
} from '@/lib/achievements/catalog'
import {
  SHOWCASE_SLOT_COUNT,
  isShowcaseAutoMode,
  resolveShowcaseSlots,
  showcaseCatalogTotal,
} from '@/lib/achievements/showcase'
import type { AchievementId, LocalAchievementUnlock } from '@/lib/achievements/types'
import {
  achievementTitle,
  achievementRarityLabel,
} from '@/lib/achievements/copy'
import { GLYPHS } from './AchievementTile'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { HelpCircle } from 'lucide-react'

export function ProfileAchievementCase({
  unlocks,
  onOpenDetail,
  onEditShowcase,
}: {
  unlocks: LocalAchievementUnlock[]
  onOpenDetail: (id: AchievementId) => void
  onEditShowcase: () => void
}) {
  const navigate = useNavigate()
  const slots = resolveShowcaseSlots(unlocks)
  const auto = isShowcaseAutoMode()
  const total = showcaseCatalogTotal()
  const unlockedCount = unlocks.length

  const goAll = () => navigate('/progress?tab=achievements')

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="sr-text-overline text-[var(--sr-text-muted)]">
              {pl.achievementsShowcaseOverline}
            </p>
            {auto && unlockedCount > 0 && (
              <span className="rounded-full bg-[color-mix(in_srgb,var(--sr-brand-primary)_15%,transparent)] px-2 py-0.5 sr-text-caption font-medium text-[var(--sr-brand-primary)]">
                {pl.achievementsShowcaseAutoBadge}
              </span>
            )}
          </div>
          <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {unlockedCount === 0
              ? pl.achievementsShowcaseEmptyHint
              : auto
                ? pl.achievementsShowcaseAutoHint
                : pl.achievementsShowcasePinnedHint}
          </p>
        </div>
        <p className="shrink-0 tabular-nums sr-text-caption text-[var(--sr-text-muted)]">
          {pl.achievementsStatusCount(unlockedCount, total)}
        </p>
      </div>

      <div className="sr-ach-case" role="group" aria-label={pl.achievementsShowcaseAria}>
        <div className="sr-ach-case__frame">
          <div className="sr-ach-case__glass">
            <ul className="sr-ach-case__shelf">
              {Array.from({ length: SHOWCASE_SLOT_COUNT }, (_, i) => {
                const id = slots[i]
                const def = id ? ACHIEVEMENT_BY_ID[id] : null
                const unlock = id ? unlocks.find((u) => u.id === id) : undefined
                const tierLevel = unlock?.tierLevel ?? null
                const rarity = def ? resolveDisplayRarity(def, null, tierLevel) : null
                const glyph = def ? resolveDisplayGlyph(def, tierLevel) : null
                const Icon = glyph ? (GLYPHS[glyph] ?? HelpCircle) : HelpCircle
                const hasTiers = Boolean(def?.tiers && def.tiers.length > 0)
                const maxTier = def?.tiers?.length ?? 0

                return (
                  <li key={i} className="sr-ach-case__slot">
                    {def ? (
                      <button
                        type="button"
                        onClick={() => onOpenDetail(def.id)}
                        className={cn(FOCUS_RING, 'sr-ach-case__item')}
                        aria-label={achievementTitle(def.id)}
                      >
                        <span className="sr-ach-case__icon-wrap">
                          <Icon size={22} strokeWidth={1.75} className="text-[var(--sr-text-primary)]" aria-hidden />
                        </span>
                        <span className="sr-ach-case__label">
                          {achievementTitle(def.id)}
                        </span>
                        <span className="sr-ach-case__rarity">
                          {achievementRarityLabel(rarity!)}
                        </span>
                        {hasTiers && tierLevel ? (
                          <span className="sr-ach-case__tier">
                            {pl.achievementsTierLevel(tierLevel, maxTier)}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          FOCUS_RING,
                          'sr-ach-case__item sr-ach-case__item--empty',
                          unlockedCount === 0 && 'pointer-events-none opacity-50',
                        )}
                        onClick={unlockedCount > 0 ? onEditShowcase : undefined}
                        aria-label={
                          unlockedCount > 0
                            ? pl.achievementsShowcaseAddSlot
                            : pl.achievementsShowcaseEmptySlot
                        }
                        disabled={unlockedCount === 0}
                      >
                        <span className="sr-ach-case__icon-wrap sr-ach-case__icon-wrap--empty">
                          {unlockedCount > 0 ? (
                            <Plus size={18} strokeWidth={1.75} />
                          ) : (
                            <span className="text-xs font-medium tabular-nums">{i + 1}</span>
                          )}
                        </span>
                        <span className="sr-ach-case__label sr-ach-case__label--empty">
                          {unlockedCount > 0 ? pl.achievementsShowcaseAddSlot : ''}
                        </span>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="sr-ach-case__ledge" aria-hidden />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(FOCUS_RING, 'shrink-0')}
          onClick={onEditShowcase}
          disabled={unlockedCount === 0}
        >
          {pl.achievementsShowcaseEdit}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(FOCUS_RING, 'shrink-0')}
          onClick={goAll}
        >
          {pl.achievementsProfileSeeAll}
        </Button>
      </div>
    </div>
  )
}
