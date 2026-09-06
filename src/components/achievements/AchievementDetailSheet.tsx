import { format } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { Sheet } from '@/components/ui/Sheet'
import { AchievementTile } from './AchievementTile'
import type { AchievementDef, LocalAchievementUnlock } from '@/lib/achievements/types'
import {
  achievementDesc,
  achievementRarityLabel,
  achievementTitle,
  achievementTrackLabel,
  trophyFullLabel,
} from '@/lib/achievements/copy'
import { resolveTier, achievementProgress } from '@/lib/achievements/catalog'
import { trophyTierFor, trophyShapeFor } from '@/lib/achievements/trophy-tier'
import { pl } from '@/i18n/pl'

export function AchievementDetailSheet({
  open,
  onClose,
  def,
  unlock,
  progress,
  snapshot,
}: {
  open: boolean
  onClose: () => void
  def: AchievementDef
  unlock?: LocalAchievementUnlock
  progress?: { current: number; target: number }
  /** Snapshot for resolving tier info on locked achievements. */
  snapshot?: import('@/lib/achievements/types').AchievementSnapshot
}) {
  const unlocked = Boolean(unlock)
  const secretLocked = Boolean(def.isSecret && !unlocked)
  const title = secretLocked ? pl.achievementsSecretLocked : achievementTitle(def.id)
  const body = secretLocked ? pl.achievementsSecretLockedHint : achievementDesc(def.id)

  const tierLevel = unlock?.tierLevel ?? null
  const hasTiers = Boolean(def.tiers && def.tiers.length > 0)
  const maxTier = def.tiers?.length ?? 0
  const resolved = snapshot && hasTiers ? resolveTier(def, snapshot) : null
  // For locked: show resolved level (could be 0). For unlocked: show stored tier level.
  const displayLevel = (unlocked ? tierLevel : resolved?.level ?? 0) ?? 0
  const nextTierDef = hasTiers && displayLevel < maxTier ? def.tiers![displayLevel] : null
  const currentTierDef = hasTiers && displayLevel > 0 ? def.tiers![displayLevel - 1] : null
  const trophyTier = trophyTierFor(def, unlocked, tierLevel)
  const trophyShape = trophyShapeFor(def)

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-3 pb-2">
        <AchievementTile
          def={def}
          unlocked={unlocked}
          tierLevel={tierLevel}
          size="lg"
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
            {achievementRarityLabel(
              // For tiered: show current tier rarity (or first tier rarity if locked)
              // For non-tiered: show base rarity
              hasTiers
                ? (currentTierDef?.rarity ?? def.tiers![0]!.rarity)
                : def.rarity,
            )}
            {trophyTier && (
              <>
                <span className="mx-1.5 text-[var(--sr-border-subtle)]">·</span>
                <span className="font-medium text-[var(--sr-text-secondary)]">
                  {trophyFullLabel(trophyTier, trophyShape)}
                </span>
              </>
            )}
          </span>
        </p>

        {/* Tier indicator for progressive achievements */}
        {hasTiers && (
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-1.5" aria-hidden>
              {Array.from({ length: maxTier }, (_, i) => (
                <span
                  key={i}
                  className={
                    i < displayLevel
                      ? 'h-2 w-2 rounded-full bg-[var(--sr-brand-primary)]'
                      : 'h-2 w-2 rounded-full bg-[var(--sr-border-subtle)]'
                  }
                />
              ))}
            </div>
            <p className="sr-text-caption text-[var(--sr-text-muted)]">
              {pl.achievementsTierLevel(displayLevel, maxTier)}
            </p>
          </div>
        )}

        <p className="text-center sr-text-body-sm text-[var(--sr-text-secondary)]">{body}</p>

        {unlocked && unlock && (
          <p className="sr-text-caption text-[var(--sr-text-muted)]">
            {pl.achievementsUnlockedOn(
              format(new Date(unlock.unlockedAt), 'd MMM yyyy', { locale: dateFnsLocale() }),
            )}
          </p>
        )}

        {/* Tier threshold info — show current tier threshold and next tier goal */}
        {hasTiers && unlocked && currentTierDef && (
          <p className="sr-text-caption text-[var(--sr-text-muted)]">
            {nextTierDef
              ? pl.achievementsTierNext(currentTierDef.threshold, nextTierDef.threshold)
              : pl.achievementsTierMaxed()}
          </p>
        )}

        {/* Progress bar for unlocked tiered achievements with a next tier to reach */}
        {hasTiers && unlocked && nextTierDef && currentTierDef && snapshot && (
          <div className="w-full space-y-1.5 pt-1">
            <div className="flex justify-between sr-text-caption text-[var(--sr-text-secondary)]">
              <span>{pl.achievementsNextTier}</span>
              <span className="tabular-nums">
                {pl.achievementsProgress(
                  achievementProgress(def.id, snapshot)?.current ?? currentTierDef.threshold,
                  nextTierDef.threshold,
                )}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-muted)]"
              role="progressbar"
              aria-valuenow={Math.max(currentTierDef.threshold, achievementProgress(def.id, snapshot)?.current ?? currentTierDef.threshold)}
              aria-valuemin={currentTierDef.threshold}
              aria-valuemax={nextTierDef.threshold}
            >
              <div
                className="h-full rounded-full bg-[var(--sr-brand-primary)] transition-[width] duration-300"
                style={{
                  width: `${(() => {
                    const cur = achievementProgress(def.id, snapshot)?.current ?? currentTierDef.threshold
                    const span = nextTierDef.threshold - currentTierDef.threshold
                    if (span <= 0) return 100
                    // Clamp to 0–100: stats may have decreased since the tier was earned
                    const ratio = (cur - currentTierDef.threshold) / span
                    return Math.min(100, Math.max(0, Math.round(ratio * 100)))
                  })()}%`,
                }}
              />
            </div>
          </div>
        )}

        {!unlocked && !secretLocked && progress && (
          <div className="w-full space-y-1.5 pt-1">
            <div className="flex justify-between sr-text-caption text-[var(--sr-text-secondary)]">
              <span>{pl.achievementsInProgress}</span>
              <span className="tabular-nums">
                {pl.achievementsProgress(progress.current, progress.target)}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-muted)]"
              role="progressbar"
              aria-valuenow={progress.current}
              aria-valuemin={0}
              aria-valuemax={progress.target}
            >
              <div
                className="h-full rounded-full bg-[var(--sr-brand-primary)] transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, Math.round((progress.current / progress.target) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}

        {!unlocked && !secretLocked && !progress && (
          <p className="sr-text-caption text-[var(--sr-text-muted)]">{pl.achievementsLockedHint}</p>
        )}
      </div>
    </Sheet>
  )
}
