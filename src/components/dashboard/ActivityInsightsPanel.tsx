import type { ActivityInsights } from '@/lib/weekly-recap'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

function repsHeadline(insights: ActivityInsights): string | null {
  const { reps14d, repsPrev14d, repsChangePct } = insights
  if (reps14d === 0 && repsPrev14d === 0) return pl.homeInsightNoActivity
  if (repsPrev14d === 0 && reps14d > 0) return pl.homeRepsChangeNew(reps14d)
  if (repsChangePct === null) return null
  if (repsChangePct > 0) return pl.homeRepsChangeUp
  if (repsChangePct < 0) return pl.homeRepsChangeDown
  return pl.homeRepsChangeSame
}

function badgeAccessibleLabel(insights: ActivityInsights): string {
  const { reps14d, repsPrev14d, repsChangePct } = insights
  if (repsPrev14d === 0 && reps14d > 0) return pl.homeRepsBadgeNew
  if (repsChangePct === null || repsChangePct === 0) return pl.homeRepsBadgeSame
  if (repsChangePct > 0) return pl.homeRepsBadgeUp(repsChangePct)
  return pl.homeRepsBadgeDown(Math.abs(repsChangePct))
}

function PctBadge({
  pct,
  risingNew,
  label,
}: {
  pct: number | null
  risingNew?: boolean
  label: string
}) {
  if (risingNew) {
    return (
      <span
        className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sr-success)_18%,transparent)] px-1 text-sm font-bold text-[var(--sr-success)]"
        aria-label={label}
      >
        ↑
      </span>
    )
  }
  if (pct === null || pct === 0) {
    return (
      <span
        className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-base)] px-1 text-sm font-bold text-[var(--sr-text-muted)]"
        aria-label={label}
      >
        →
      </span>
    )
  }
  const up = pct > 0
  const compact = Math.abs(pct) >= 100
  return (
    <span
      className={cn(
        'flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-1 font-bold tabular-nums',
        compact ? 'text-xs' : 'text-sm',
        up
          ? 'bg-[color-mix(in_srgb,var(--sr-success)_18%,transparent)] text-[var(--sr-success)]'
          : 'bg-[color-mix(in_srgb,var(--sr-error)_18%,transparent)] text-[var(--sr-error)]',
      )}
      aria-label={label}
    >
      {up ? '+' : '−'}
      {Math.abs(pct)}%
    </span>
  )
}

/** Compact trend only — absolute 14d numbers live in MetricStrip above. */
export function ActivityInsightsPanel({ insights }: { insights: ActivityInsights }) {
  const headline = repsHeadline(insights)
  const recordNote =
    insights.bestStreakWeeks > insights.streakWeeks && insights.bestStreakWeeks > 0
      ? pl.homeBestStreakRecord(insights.bestStreakWeeks)
      : null
  const earlierLine =
    insights.repsPrev14d > 0
      ? pl.homeActivityRepsEarlier(insights.repsPrev14d)
      : insights.sessionsPrev14d > 0
        ? pl.homeActivitySessionsEarlier(insights.sessionsPrev14d)
        : null

  if (!headline && !recordNote) return null

  return (
    <div
      className="mt-3 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-3 py-2.5"
      aria-label={pl.homeActivityInsightsAria}
    >
      {headline && (
        <div className="flex items-start gap-3">
          <PctBadge
            pct={insights.repsChangePct}
            risingNew={insights.repsPrev14d === 0 && insights.reps14d > 0}
            label={badgeAccessibleLabel(insights)}
          />
          <div className="min-w-0 space-y-0.5">
            <p className="sr-text-body-sm leading-snug text-[var(--sr-text-primary)]">{headline}</p>
            {earlierLine && (
              <p className="sr-text-body-sm tabular-nums text-[var(--sr-text-muted)]">{earlierLine}</p>
            )}
            {recordNote && (
              <p className="sr-text-caption text-[var(--sr-text-muted)]">{recordNote}</p>
            )}
          </div>
        </div>
      )}
      {!headline && recordNote && (
        <p className="sr-text-caption text-[var(--sr-text-muted)]">{recordNote}</p>
      )}
    </div>
  )
}
