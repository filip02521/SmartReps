import { MetricStrip } from '@/components/ui/MetricStrip'
import type { AuthorImpactStats, AchievementId } from '@/lib/achievements/types'
import { pl } from '@/i18n/pl'
import { achievementTitle } from '@/lib/achievements/copy'

export function CommunityImpactStrip({
  impact,
  nextAchievement,
}: {
  impact: AuthorImpactStats
  nextAchievement?: { id: AchievementId; current: number; target: number } | null
}) {
  return (
    <div className="space-y-3">
      <p className="sr-text-overline text-[var(--sr-text-muted)]">{pl.communityImpactTitle}</p>
      <MetricStrip
        metrics={[
          { label: pl.communityImpactLikes, value: impact.likeTotal },
          { label: pl.communityImpactImports, value: impact.importTotal },
          { label: pl.communityImpactTrained, value: impact.trainedTotal },
        ]}
      />
      {nextAchievement && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="sr-text-caption text-[var(--sr-text-secondary)]">
              {pl.communityImpactNext}:{' '}
              <span className="font-medium text-[var(--sr-text-primary)]">
                {achievementTitle(nextAchievement.id)}
              </span>
            </p>
            <span className="tabular-nums sr-text-caption text-[var(--sr-text-muted)]">
              {pl.achievementsProgress(nextAchievement.current, nextAchievement.target)}
            </span>
          </div>
          <div
            className="h-1 overflow-hidden rounded-full bg-[var(--sr-bg-muted)]"
            role="progressbar"
            aria-valuenow={nextAchievement.current}
            aria-valuemin={0}
            aria-valuemax={nextAchievement.target}
          >
            <div
              className="h-full rounded-full bg-[var(--sr-brand-primary)]"
              style={{
                width: `${Math.min(
                  100,
                  Math.round((nextAchievement.current / nextAchievement.target) * 100),
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
