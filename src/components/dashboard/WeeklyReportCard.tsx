import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { showToast } from '@/stores/toast-store'
import type { LocalAiInsight } from '@/lib/db'
import { X, Calendar, Flame, TrendingUp, TrendingDown, Minus, Dumbbell } from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'

type WeeklyMetrics = {
  sessions: number
  totalReps: number
  streakWeeks: number
  repsWeekChangePct: number | null
  weekStart: string
  weekEnd: string
}

function parseMetrics(insight: LocalAiInsight): WeeklyMetrics | null {
  if (!insight.metricsJson) return null
  try {
    return JSON.parse(insight.metricsJson) as WeeklyMetrics
  } catch {
    return null
  }
}

function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart)
  const end = new Date(weekEnd)
  end.setDate(end.getDate() - 1) // inclusive end
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) {
    return `${format(start, 'd', { locale: plLocale })}–${format(end, 'd MMM', { locale: plLocale })}`
  }
  return `${format(start, 'd MMM', { locale: plLocale })} – ${format(end, 'd MMM', { locale: plLocale })}`
}

function MetricTile({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)] px-2 py-2.5 text-center">
      <div className="flex items-center gap-1.5" style={{ color: accent }}>
        {icon}
        <span className="text-base font-bold tabular-nums text-[var(--sr-text-primary)]">
          {value}
        </span>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
        {label}
      </span>
    </div>
  )
}

export function WeeklyReportCard({
  insight,
  onDismissed,
}: {
  insight: LocalAiInsight
  onDismissed?: () => void
}) {
  if (insight.dismissedAt) return null

  const metrics = parseMetrics(insight)
  const weekRange = metrics ? formatWeekRange(metrics.weekStart, metrics.weekEnd) : null
  const changePct = metrics?.repsWeekChangePct
  const trendIcon = changePct == null
    ? <Minus size={14} aria-hidden />
    : changePct > 0
      ? <TrendingUp size={14} aria-hidden />
      : changePct < 0
        ? <TrendingDown size={14} aria-hidden />
        : <Minus size={14} aria-hidden />
  const trendColor = changePct == null
    ? 'var(--sr-text-muted)'
    : changePct > 0
      ? 'var(--sr-success)'
      : changePct < 0
        ? 'var(--sr-error)'
        : 'var(--sr-text-muted)'
  const trendLabel = changePct == null
    ? '—'
    : changePct > 0
      ? `+${Math.round(changePct)}%`
      : changePct < 0
        ? `${Math.round(changePct)}%`
        : '0%'

  return (
    <section
      aria-live="polite"
      className="sr-coach-msg-in mb-6 overflow-hidden rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_40%,var(--sr-bg-elevated))]"
    >
      {/* Header */}
      <div className="flex items-start gap-2.5 border-b border-[var(--sr-border-subtle)] px-4 py-3">
        <AiCoachMark size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight text-[var(--sr-text-primary)]">
            {insight.title}
          </h3>
          {weekRange && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--sr-text-muted)]">
              <Calendar size={11} aria-hidden />
              {weekRange}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label={pl.coachPostWorkoutDismiss}
          onClick={async () => {
            const dismissed = { ...insight, dismissedAt: new Date().toISOString() }
            await db.aiInsights.put(dismissed)
            void enqueueSync('ai_insights', 'update', dismissed)
            showToast(pl.coachPostWorkoutDismissed, 'info')
            onDismissed?.()
          }}
          className="shrink-0 rounded-[var(--sr-radius-sm)] p-1 text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Metrics grid */}
      {metrics && (
        <div className="grid grid-cols-4 gap-2 px-4 py-3">
          <MetricTile
            icon={<Dumbbell size={14} aria-hidden />}
            label={pl.coachWeeklyMetricSessions}
            value={String(metrics.sessions)}
            accent="var(--sr-brand-primary)"
          />
          <MetricTile
            icon={<span className="text-xs font-bold" aria-hidden>Σ</span>}
            label={pl.coachWeeklyMetricReps}
            value={String(metrics.totalReps)}
            accent="var(--sr-brand-primary)"
          />
          <MetricTile
            icon={<Flame size={14} aria-hidden />}
            label={pl.coachWeeklyMetricStreak}
            value={String(metrics.streakWeeks)}
            accent={metrics.streakWeeks > 0 ? 'var(--sr-warning)' : 'var(--sr-text-muted)'}
          />
          <MetricTile
            icon={trendIcon}
            label={pl.coachWeeklyMetricChange}
            value={trendLabel}
            accent={trendColor}
          />
        </div>
      )}

      {/* Body — coach insight text */}
      <div className="px-4 pb-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {insight.body}
        </p>
        {insight.source === 'ai' && (
          <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.coachSourceAi}
          </p>
        )}
      </div>
    </section>
  )
}
