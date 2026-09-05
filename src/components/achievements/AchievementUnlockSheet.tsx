import { useEffect } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { AchievementTile } from './AchievementTile'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import type { AchievementId, LocalAchievementUnlock } from '@/lib/achievements/types'
import {
  achievementDesc,
  achievementTitle,
  achievementRarityLabel,
  achievementTrackLabel,
} from '@/lib/achievements/copy'
import { resolveDisplayRarity } from '@/lib/achievements/catalog'
import { markUnlockSeen } from '@/lib/achievements/store'
import { playTrophyFeedback, initAchievementAudio } from '@/lib/achievements/feedback'
import { track } from '@/lib/analytics'
import { pl } from '@/i18n/pl'

export function AchievementUnlockSheet({
  achievementId,
  unlock,
  onDone,
}: {
  achievementId: AchievementId | null
  unlock?: LocalAchievementUnlock
  onDone: () => void
}) {
  const def = achievementId ? ACHIEVEMENT_BY_ID[achievementId] : null

  useEffect(() => {
    if (!achievementId || !def) return
    track('achievement_unlock', { id: achievementId, rarity: def.rarity, tier: unlock?.tierLevel })
    // Play trophy fanfare for gold/diamond/legendary-non-tiered unlocks
    const tierLevel = unlock?.tierLevel ?? 0
    const isTrophy =
      tierLevel >= 3 || (def.rarity === 'legendary' && tierLevel <= 1)
    if (isTrophy) {
      void (async () => {
        await initAchievementAudio()
        playTrophyFeedback()
      })()
    }
  }, [achievementId, def, unlock?.tierLevel])

  if (!def || !achievementId) return null
  const id = achievementId
  const tierLevel = unlock?.tierLevel ?? null
  const displayRarity = resolveDisplayRarity(def, null, tierLevel)
  const hasTiers = Boolean(def.tiers && def.tiers.length > 0)
  const isTierUpgrade = hasTiers && tierLevel && tierLevel > 1

  async function handleClose() {
    await markUnlockSeen(id)
    onDone()
  }

  return (
    <Sheet
      open
      onClose={() => void handleClose()}
      title={isTierUpgrade ? pl.achievementsTierUpgradeTitle : pl.achievementsUnlockTitle}
      showClose={false}
    >
      <div className="sr-ach-in flex flex-col items-center gap-3">
        <AchievementTile
          def={def}
          unlocked
          tierLevel={tierLevel}
          size="lg"
          pulse={
            def.rarity === 'legendary' ||
            (def.tiers && def.tiers.length > 0 && (tierLevel ?? 0) >= def.tiers.length - 1)
          }
          showCaption={false}
        />
        <p className="flex items-center gap-2 sr-text-overline text-[var(--sr-text-muted)]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sr-brand-primary)]"
            aria-hidden
          />
          <span>
            {achievementTrackLabel(def.track)}
            <span className="mx-1.5 text-[var(--sr-border-subtle)]">·</span>
            {achievementRarityLabel(displayRarity)}
          </span>
        </p>
        <h3 className="text-center text-lg font-semibold text-[var(--sr-text-primary)]">
          {achievementTitle(id)}
        </h3>
        {hasTiers && tierLevel ? (
          <>
            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: def.tiers!.length }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < tierLevel
                      ? 'h-2 w-2 rounded-full bg-[var(--sr-brand-primary)]'
                      : 'h-2 w-2 rounded-full bg-[var(--sr-border-subtle)]'
                  }
                />
              ))}
            </div>
            <p className="sr-text-caption text-[var(--sr-brand-primary)]">
              {pl.achievementsTierLevel(tierLevel, def.tiers!.length)}
            </p>
          </>
        ) : null}
        <p className="text-center sr-text-body-sm text-[var(--sr-text-secondary)]">
          {achievementDesc(id)}
        </p>
        <Button className="mt-2 w-full" size="touch" onClick={() => void handleClose()}>
          {pl.close}
        </Button>
      </div>
    </Sheet>
  )
}

export function AchievementBackfillSheet({
  count,
  onClose,
  onSeeAll,
}: {
  count: number
  onClose: () => void
  onSeeAll: () => void
}) {
  return (
    <Sheet open onClose={onClose} title={pl.achievementsBackfillTitle}>
      <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
        {pl.achievementsBackfillBody(count)}
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <Button size="touch" onClick={onSeeAll}>
          {pl.achievementsBackfillCta}
        </Button>
        <Button variant="ghost" onClick={onClose}>
          {pl.close}
        </Button>
      </div>
    </Sheet>
  )
}
