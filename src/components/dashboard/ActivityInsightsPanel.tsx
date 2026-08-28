import type { ActivityInsights } from '@/lib/weekly-recap'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

function repsComparisonMessage(insights: ActivityInsights): string | null {
  const { reps14d, repsPrev14d, repsChangePct } = insights
  if (reps14d === 0 && repsPrev14d === 0) return pl.homeInsightNoActivity
  if (repsPrev14d === 0 && reps14d > 0) return pl.homeRepsChangeNew(reps14d)
  if (repsChangePct === null) return null
  if (repsChangePct > 0) return pl.homeRepsChangeUp
  if (repsChangePct < 0) return pl.homeRepsChangeDown
  return pl.homeRepsChangeSame
}

function sessionsComparisonMessage(insights: ActivityInsights): string | null {
  const { sessions14d, sessionsPrev14d, sessionsDelta14d } = insights
  if (sessions14d === 0 && sessionsPrev14d === 0) return null
  if (sessionsDelta14d > 0) return pl.homeSessionsDeltaUp(sessionsDelta14d)
  if (sessionsDelta14d < 0) return pl.homeSessionsDeltaDown(Math.abs(sessionsDelta14d))
  return pl.homeSessionsDeltaSame
}

function secondaryInsights(insights: ActivityInsights): string[] {
  const parts: string[] = []
  const weekMsg =
    insights.repsWeekChangePct !== null && insights.repsWeekChangePct !== 0
      ? insights.repsWeekChangePct > 0
        ? pl.homeWeekRepsChangeUp(insights.repsWeekChangePct)
        : pl.homeWeekRepsChangeDown(Math.abs(insights.repsWeekChangePct))
      : null
  if (weekMsg) parts.push(weekMsg)
  if (insights.bestStreakWeeks > insights.streakWeeks && insights.bestStreakWeeks > 0) {
    parts.push(pl.homeBestStreakRecord(insights.bestStreakWeeks))
  }
  return parts
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

export function ActivityInsightsPanel({ insights }: { insights: ActivityInsights }) {
  const repsMsg = repsComparisonMessage(insights)
  const sessionsMsg = sessionsComparisonMessage(insights)
  const secondary = secondaryInsights(insights)
  const showRepsCompare = insights.repsPrev14d > 0

  if (!repsMsg && !sessionsMsg && secondary.length === 0) return null

  return (
    <div className="mt-3 space-y-2" aria-label={pl.homeActivityInsightsAria}>
      {repsMsg && (
        <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-3 py-2.5">
          <div className="flex items-center gap-3">
            <PctBadge
              pct={insights.repsChangePct}
              risingNew={insights.repsPrev14d === 0 && insights.reps14d > 0}
              label={badgeAccessibleLabel(insights)}
            />
            <div className="min-w-0">
              <p className="sr-text-body-sm leading-snug text-[var(--sr-text-primary)]">{repsMsg}</p>
              {showRepsCompare && (
                <p className="mt-0.5 sr-text-body-sm tabular-nums text-[var(--sr-text-muted)]">
                  {pl.homeActivityRepsCompare(insights.reps14d, insights.repsPrev14d)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {(sessionsMsg || secondary.length > 0) && (
        <p className="sr-text-body-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {[sessionsMsg, ...secondary].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}
