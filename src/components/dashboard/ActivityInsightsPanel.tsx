import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react'
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

type TrendKind = 'up' | 'down' | 'same' | 'new'

function resolveTrend(insights: ActivityInsights): TrendKind {
  const { reps14d, repsPrev14d, repsChangePct } = insights
  if (repsPrev14d === 0 && reps14d > 0) return 'new'
  if (repsChangePct === null || repsChangePct === 0) return 'same'
  return repsChangePct > 0 ? 'up' : 'down'
}

function trendAccent(trend: TrendKind): { accent: string; muted: string; ring: string } {
  if (trend === 'up') return { accent: 'var(--sr-success)', muted: 'color-mix(in srgb, var(--sr-success) 15%, transparent)', ring: 'var(--sr-success)' }
  if (trend === 'down') return { accent: 'var(--sr-error)', muted: 'color-mix(in srgb, var(--sr-error) 15%, transparent)', ring: 'var(--sr-error)' }
  if (trend === 'same') return { accent: 'var(--sr-text-muted)', muted: 'color-mix(in srgb, var(--sr-text-muted) 12%, transparent)', ring: 'var(--sr-border-subtle)' }
  return { accent: 'var(--sr-brand-primary)', muted: 'color-mix(in srgb, var(--sr-brand-primary) 15%, transparent)', ring: 'var(--sr-brand-primary)' }
}

function TrendBadge({
  trend,
  pct,
  label,
}: {
  trend: TrendKind
  pct: number | null
  label: string
}) {
  const chrome = trendAccent(trend)

  if (trend === 'new') {
    return (
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ background: chrome.muted, color: chrome.accent }}
        aria-label={label}
      >
        <Sparkles size={20} strokeWidth={2.25} />
      </span>
    )
  }

  if (trend === 'same') {
    return (
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]"
        style={{ color: chrome.accent }}
        aria-label={label}
      >
        <Minus size={20} strokeWidth={2.25} />
      </span>
    )
  }

  const compact = pct !== null && Math.abs(pct) >= 100
  return (
    <span
      className={cn(
        'flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-full font-bold tabular-nums',
        compact ? 'text-[10px]' : 'text-xs',
      )}
      style={{ background: chrome.muted, color: chrome.accent }}
      aria-label={label}
    >
      {trend === 'up' ? <TrendingUp size={14} strokeWidth={2.5} /> : <TrendingDown size={14} strokeWidth={2.5} />}
      {pct !== null && (
        <span className="leading-none">
          {trend === 'up' ? '+' : '−'}
          {Math.abs(pct)}%
        </span>
      )}
    </span>
  )
}

/** Compact trend only — absolute 14d numbers live in MetricStrip above. */
export function ActivityInsightsPanel({
  insights,
  ariaLabel = pl.homeActivityInsightsAria,
}: {
  insights: ActivityInsights
  ariaLabel?: string
}) {
  const headline = repsHeadline(insights)
  const trend = resolveTrend(insights)
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

  const chrome = trendAccent(trend)

  return (
    <div
      className="mt-3 overflow-hidden rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)]"
      aria-label={ariaLabel}
    >
      <div
        className="px-3.5 py-3"
        style={{
          backgroundImage: `linear-gradient(135deg, ${chrome.muted} 0%, var(--sr-bg-elevated) 60%)`,
        }}
      >
        {headline && (
          <div className="flex items-center gap-3">
            <TrendBadge
              trend={trend}
              pct={insights.repsChangePct}
              label={badgeAccessibleLabel(insights)}
            />
            <div className="min-w-0 space-y-0.5">
              <p className="sr-text-body-sm font-medium leading-snug text-[var(--sr-text-primary)]">
                {headline}
              </p>
              {earlierLine && (
                <p className="sr-text-caption tabular-nums text-[var(--sr-text-muted)]">
                  {earlierLine}
                </p>
              )}
            </div>
          </div>
        )}
        {recordNote && (
          <p className="mt-1.5 sr-text-caption text-[var(--sr-text-muted)]">{recordNote}</p>
        )}
      </div>
    </div>
  )
}
