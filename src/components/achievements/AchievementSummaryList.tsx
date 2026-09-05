import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AchievementTile } from './AchievementTile'
import { ACHIEVEMENT_BY_ID, resolveDisplayRarity } from '@/lib/achievements/catalog'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import {
  achievementTitle,
  achievementRarityLabel,
} from '@/lib/achievements/copy'
import { playAchievementUnlockSequence, playTrophyFeedback, initAchievementAudio } from '@/lib/achievements/feedback'
import { trophyTierFor, type TrophyTier } from '@/lib/achievements/trophy-tier'
import { markUnlockSeen } from '@/lib/achievements/store'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

/**
 * Inline list of newly unlocked achievements shown in session summary.
 * Plays sound + vibration on mount, marks unlocks as seen on unmount.
 */
export function AchievementSummaryList({ unlocks }: { unlocks: LocalAchievementUnlock[] }) {
  const navigate = useNavigate()
  const playedRef = useRef(false)
  const unlocksRef = useRef(unlocks)

  useEffect(() => {
    unlocksRef.current = unlocks
  }, [unlocks])

  useEffect(() => {
    if (playedRef.current) return
    if (unlocks.length === 0) return
    playedRef.current = true
    void (async () => {
      await initAchievementAudio()
      const rarities = unlocks
        .map((u) => {
          const def = ACHIEVEMENT_BY_ID[u.id]
          if (!def) return null
          return resolveDisplayRarity(def, null, u.tierLevel)
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
      // Use shared trophy tier resolver — ensures consistency with AchievementTile
      // Play the highest-tier fanfare across all unlocks in this batch
      const tierOrder: Record<TrophyTier, number> = { bronze: 0, silver: 1, gold: 2, diamond: 3 }
      let highestTrophyTier: TrophyTier | null = null
      for (const u of unlocks) {
        const def = ACHIEVEMENT_BY_ID[u.id]
        if (!def) continue
        const tier = trophyTierFor(def, true, u.tierLevel)
        if (tier && (!highestTrophyTier || tierOrder[tier] > tierOrder[highestTrophyTier])) {
          highestTrophyTier = tier
        }
      }
      if (highestTrophyTier) playTrophyFeedback(highestTrophyTier)
      else playAchievementUnlockSequence(rarities)
    })()
  }, [unlocks])

  // Mark as seen when component unmounts (user leaves summary)
  useEffect(() => {
    return () => {
      for (const u of unlocksRef.current) {
        void markUnlockSeen(u.id)
      }
    }
  }, [])

  if (unlocks.length === 0) return null

  const hasMultiple = unlocks.length > 1

  return (
    <Card className="border border-[var(--sr-brand-primary)] bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,transparent))]">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          {pl.achievementsSummaryIcon}
        </span>
        <div>
          <p className="font-semibold text-[var(--sr-text-primary)]">
            {hasMultiple
              ? pl.achievementsSummaryTitleMulti(unlocks.length)
              : pl.achievementsSummaryTitle}
          </p>
          <p className="sr-text-caption text-[var(--sr-text-muted)]">
            {pl.achievementsSummarySubtitle}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {unlocks.map((unlock) => {
          const def = ACHIEVEMENT_BY_ID[unlock.id]
          if (!def) return null
          const rarity = resolveDisplayRarity(def, null, unlock.tierLevel)
          const isTierUpgrade = Boolean(def.tiers && unlock.tierLevel && unlock.tierLevel > 1)
          return (
            <div
              key={unlock.id}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-[var(--sr-radius-md)] p-2',
                'bg-[var(--sr-bg-elevated)]',
              )}
            >
              <AchievementTile
                def={def}
                unlocked
                tierLevel={unlock.tierLevel}
                size="md"
                showCaption={false}
              />
              <div className="text-center">
                <p className="sr-text-caption font-medium text-[var(--sr-text-primary)]">
                  {achievementTitle(unlock.id)}
                </p>
                <p className="sr-text-caption text-[var(--sr-text-muted)]">
                  {achievementRarityLabel(rarity)}
                </p>
                {isTierUpgrade && (
                  <p className="sr-text-caption text-[var(--sr-brand-primary)]">
                    {pl.achievementsTierLevel(unlock.tierLevel ?? 0, def.tiers!.length)}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Button
        variant="ghost"
        size="touch"
        fullWidth
        className="mt-4"
        onClick={() => navigate('/progress?tab=achievements')}
      >
        {pl.achievementsSummarySeeAll}
      </Button>
    </Card>
  )
}
