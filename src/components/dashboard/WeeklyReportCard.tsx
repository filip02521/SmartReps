import { useId, useRef, useState } from 'react'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { showToast } from '@/stores/toast-store'
import type { LocalAiInsight } from '@/lib/db'
import {
  X,
  Calendar,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Dumbbell,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Clock,
  Trophy,
  Layers,
} from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { format, formatDistanceToNow } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'

type WeeklyMetrics = {
  sessions: number
  totalReps: number
  totalVolume?: number
  trainingDays?: number
  avgDurationMin?: number
  prCount?: number
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
    return `${format(start, 'd', { locale: dateFnsLocale() })}–${format(end, 'd MMM', { locale: dateFnsLocale() })}`
  }
  return `${format(start, 'd MMM', { locale: dateFnsLocale() })} – ${format(end, 'd MMM', { locale: dateFnsLocale() })}`
}

/** Truncate body to a single-line teaser for the collapsed state. */
function teaser(body: string, maxLen = 120): string {
  const single = body.replace(/\s+/g, ' ').trim()
  if (single.length <= maxLen) return single
  return `${single.slice(0, maxLen).trimEnd()}…`
}

/** Compact number formatting for volume (e.g. 12 400 → 12.4k). */
function formatCompact(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString()
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
    <div className="flex flex-col items-center gap-1.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-1.5 py-2.5 text-center transition-colors hover:border-[var(--sr-border-strong)]">
      <div className="flex items-center gap-1" style={{ color: accent }}>
        {icon}
        <span className="text-base font-bold tabular-nums leading-none text-[var(--sr-text-primary)]">
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
  onConnectAi,
  onRegenerate,
  regenerating = false,
}: {
  insight: LocalAiInsight
  onDismissed?: () => void
  onConnectAi?: () => void
  onRegenerate?: () => void
  regenerating?: boolean
}) {
  const panelId = useId().replace(/[:]/g, '')
  const [expanded, setExpanded] = useState(false)
  const [readAt, setReadAt] = useState<string | undefined>(insight.readAt)
  const markedRef = useRef(false)

  const isNew = !readAt

  // Mark as read when the user expands for the first time.
  // Persists locally + enqueues sync so the "new" state clears on all devices.
  const markAsRead = () => {
    if (markedRef.current || readAt) return
    markedRef.current = true
    const now = new Date().toISOString()
    setReadAt(now)
    void (async () => {
      try {
        await db.aiInsights.update(insight.id, { readAt: now })
        void enqueueSync('ai_insights', 'update', { ...insight, readAt: now })
      } catch {
        // Non-blocking — "new" badge is cosmetic
      }
    })()
  }

  // Defensive — parent already filters dismissed, but guard against stale props.
  if (insight.dismissedAt) return null

  const toggleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next) markAsRead()
  }

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

  const updatedLabel = formatDistanceToNow(new Date(insight.createdAt), {
    addSuffix: true,
    locale: dateFnsLocale(),
  })

  // Detail metrics (expanded only) — secondary stats from the week
  const hasDetailMetrics = metrics && (
    metrics.trainingDays != null ||
    metrics.avgDurationMin != null ||
    metrics.prCount != null ||
    metrics.totalVolume != null
  )

  return (
    <section
      aria-live="polite"
      aria-label={pl.coachWeeklyReportSectionAria}
      className="sr-coach-msg-in overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]"
    >
      {/* Header — clickable to toggle expand/collapse */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpand}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleExpand()
          }
        }}
        aria-expanded={expanded}
        aria-controls={`weekly-report-body-${panelId}`}
        aria-label={isNew ? pl.coachWeeklyReportNewAria : expanded ? pl.coachWeeklyReportCollapse : pl.coachWeeklyReportExpand}
        className="flex w-full items-start gap-3 border-b border-[var(--sr-border-subtle)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_30%,transparent)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_40%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--sr-brand-primary)]"
      >
        <AiCoachMark size="sm" pulse={regenerating} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold leading-tight text-[var(--sr-text-primary)]">
              {insight.title}
            </h3>
            {isNew && (
              <span
                className="sr-new-badge inline-flex items-center gap-1 rounded-full bg-[var(--sr-brand-primary)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                aria-label={pl.coachWeeklyReportNew}
              >
                <span className="sr-new-badge-dot inline-block h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                {pl.coachWeeklyReportNew}
              </span>
            )}
          </div>
          {weekRange && (
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--sr-text-muted)]">
              <Calendar size={11} aria-hidden />
              {weekRange}
            </p>
          )}
        </div>
        {/* Dismiss — stopPropagation so it doesn't toggle */}
        <button
          type="button"
          aria-label={pl.coachPostWorkoutDismiss}
          onClick={async (e) => {
            e.stopPropagation()
            const dismissed = { ...insight, dismissedAt: new Date().toISOString() }
            await db.aiInsights.put(dismissed)
            void enqueueSync('ai_insights', 'update', dismissed)
            showToast(pl.coachPostWorkoutDismissed, 'info')
            onDismissed?.()
          }}
          className="shrink-0 flex min-h-12 min-w-12 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Primary metrics grid — always visible (key at-a-glance data) */}
      {metrics && (
        <div className="grid grid-cols-4 gap-2 p-4 pb-2">
          <MetricTile
            icon={<Dumbbell size={14} aria-hidden />}
            label={pl.coachWeeklyMetricSessions}
            value={String(metrics.sessions)}
            accent="var(--sr-brand-primary)"
          />
          <MetricTile
            icon={<span className="text-xs font-bold" aria-hidden>Σ</span>}
            label={pl.coachWeeklyMetricReps}
            value={formatCompact(metrics.totalReps)}
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

      {/* Collapsed teaser — preview of the coach insight + expand hint */}
      {!expanded && (
        <div className="px-4 pb-4 pt-1">
          <p className="text-sm leading-relaxed text-[var(--sr-text-secondary)]">
            {teaser(insight.body)}
          </p>
          <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[var(--sr-brand-primary)]">
            <ChevronDown size={12} aria-hidden />
            {pl.coachWeeklyReportExpandHint}
          </p>
        </div>
      )}

      {/* Expanded body — full coach insight + detail metrics + actions */}
      {expanded && (
        <div id={`weekly-report-body-${panelId}`} className="px-4 pb-4 pt-1">
          {/* Coach message — left accent border for visual distinction */}
          {regenerating ? (
            <div className="mt-2 rounded-[var(--sr-radius-sm)] border-l-2 border-[var(--sr-brand-primary)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_40%,var(--sr-bg-surface))] px-3 py-2.5">
              <p className="animate-pulse text-sm text-[var(--sr-text-muted)]">
                {pl.coachWeeklyReportRegenerating}
              </p>
            </div>
          ) : (
            <div className="mt-2 rounded-[var(--sr-radius-sm)] border-l-2 border-[var(--sr-brand-primary)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_40%,var(--sr-bg-surface))] px-3 py-2.5">
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
                {insight.body}
              </p>
            </div>
          )}

          {/* Detail metrics — secondary stats, expanded only */}
          {hasDetailMetrics && !regenerating && (
            <div className="mt-4">
              <p className="mb-2 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                {pl.coachWeeklyDetailLabel}
              </p>
              <div className="grid grid-cols-4 gap-2">
                <MetricTile
                  icon={<Calendar size={14} aria-hidden />}
                  label={pl.coachWeeklyMetricDays}
                  value={String(metrics.trainingDays ?? 0)}
                  accent="var(--sr-brand-primary)"
                />
                <MetricTile
                  icon={<Clock size={14} aria-hidden />}
                  label={pl.coachWeeklyMetricDuration}
                  value={pl.coachWeeklyMetricDurationValue(metrics.avgDurationMin ?? 0)}
                  accent="var(--sr-brand-primary)"
                />
                <MetricTile
                  icon={<Trophy size={14} aria-hidden />}
                  label={pl.coachWeeklyMetricPrs}
                  value={String(metrics.prCount ?? 0)}
                  accent={(metrics.prCount ?? 0) > 0 ? 'var(--sr-warning)' : 'var(--sr-text-muted)'}
                />
                <MetricTile
                  icon={<Layers size={14} aria-hidden />}
                  label={pl.coachWeeklyMetricVolume}
                  value={formatCompact(metrics.totalVolume ?? 0)}
                  accent="var(--sr-brand-primary)"
                />
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
              {insight.source === 'ai' ? pl.coachSourceAi : pl.coachSourceLocal}
            </span>
            <span className="text-[10px] text-[var(--sr-text-muted)]" aria-hidden>·</span>
            <span className="text-[10px] text-[var(--sr-text-muted)]">
              {pl.coachWeeklyReportUpdatedLabel(updatedLabel)}
            </span>
          </div>

          {/* Actions: connect AI (local only) + regenerate (always) */}
          <div className="mt-3 flex flex-col gap-2">
            {insight.source !== 'ai' && onConnectAi && (
              <button
                type="button"
                onClick={onConnectAi}
                className="flex w-full items-center justify-center gap-1.5 rounded-[var(--sr-radius-sm)] border border-[var(--sr-brand-primary-muted)] bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--sr-brand-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--sr-brand-primary)_16%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
              >
                <Sparkles size={13} aria-hidden />
                {pl.coachWeeklyReportConnectAiHint}
              </button>
            )}
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={regenerating}
                className="flex w-full items-center justify-center gap-1.5 rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 text-xs font-medium text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] hover:text-[var(--sr-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)] disabled:opacity-50"
              >
                <RefreshCw size={13} aria-hidden className={regenerating ? 'animate-spin' : ''} />
                {pl.coachWeeklyReportRegenerate}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
