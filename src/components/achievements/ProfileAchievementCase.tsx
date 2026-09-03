import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import {
  SHOWCASE_SLOT_COUNT,
  isShowcaseAutoMode,
  resolveShowcaseSlots,
  showcaseCatalogTotal,
} from '@/lib/achievements/showcase'
import type { AchievementId, LocalAchievementUnlock } from '@/lib/achievements/types'
import { AchievementTile } from './AchievementTile'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

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
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {pl.achievementsShowcaseOverline}
          </p>
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
                return (
                  <li key={i} className="sr-ach-case__slot">
                    {def ? (
                      <AchievementTile
                        def={def}
                        unlocked
                        size="md"
                        showCaption
                        onClick={() => onOpenDetail(def.id)}
                      />
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          FOCUS_RING,
                          'sr-ach-case__empty',
                          unlockedCount === 0 && 'pointer-events-none opacity-60',
                        )}
                        onClick={unlockedCount > 0 ? onEditShowcase : undefined}
                        aria-label={
                          unlockedCount > 0
                            ? pl.achievementsShowcaseAddSlot
                            : pl.achievementsShowcaseEmptySlot
                        }
                        disabled={unlockedCount === 0}
                      >
                        <span className="sr-ach-case__empty-icon" aria-hidden>
                          <Plus size={20} strokeWidth={1.75} />
                        </span>
                        <span className="sr-text-caption text-[var(--sr-text-muted)]">
                          {unlockedCount > 0
                            ? pl.achievementsShowcaseAddSlot
                            : pl.achievementsShowcaseEmptySlot}
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
