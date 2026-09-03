import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { Sheet } from '@/components/ui/Sheet'
import { AchievementTile } from './AchievementTile'
import type { AchievementDef, LocalAchievementUnlock } from '@/lib/achievements/types'
import {
  achievementDesc,
  achievementRarityLabel,
  achievementTitle,
  achievementTrackLabel,
} from '@/lib/achievements/copy'
import { pl } from '@/i18n/pl'

export function AchievementDetailSheet({
  open,
  onClose,
  def,
  unlock,
  progress,
}: {
  open: boolean
  onClose: () => void
  def: AchievementDef
  unlock?: LocalAchievementUnlock
  progress?: { current: number; target: number }
}) {
  const unlocked = Boolean(unlock)
  const secretLocked = Boolean(def.isSecret && !unlocked)
  const title = secretLocked ? pl.achievementsSecretLocked : achievementTitle(def.id)
  const body = secretLocked
    ? pl.achievementsSecretLockedHint
    : unlocked
      ? achievementDesc(def.id)
      : achievementDesc(def.id)

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-3 pb-2">
        <AchievementTile def={def} unlocked={unlocked} size="lg" showCaption={false} />

        <p className="flex items-center gap-2 sr-text-overline text-[var(--sr-text-muted)]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--sr-brand-primary)]"
            aria-hidden
          />
          <span>
            {achievementTrackLabel(def.track)}
            <span className="mx-1.5 text-[var(--sr-border-subtle)]">·</span>
            {achievementRarityLabel(def.rarity)}
          </span>
        </p>

        <p className="text-center sr-text-body-sm text-[var(--sr-text-secondary)]">{body}</p>

        {unlocked && unlock && (
          <p className="sr-text-caption text-[var(--sr-text-muted)]">
            {pl.achievementsUnlockedOn(
              format(new Date(unlock.unlockedAt), 'd MMM yyyy', { locale: plLocale }),
            )}
          </p>
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
