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
} from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { format, formatDistanceToNow } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'

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
    return `${format(start, 'd', { locale: dateFnsLocale() })}–${format(end, 'd MMM', { locale: dateFnsLocale() })}`
  }
  return `${format(start, 'd MMM', { locale: dateFnsLocale() })} – ${format(end, 'd MMM', { locale: dateFnsLocale() })}`
}

/** Truncate body to a single-line teaser for the collapsed state. */
function teaser(body: string, maxLen = 110): string {
  const single = body.replace(/\s+/g, ' ').trim()
  if (single.length <= maxLen) return single
  return `${single.slice(0, maxLen).trimEnd()}…`
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

  return (
    <section
      aria-live="polite"
      className="sr-coach-msg-in mb-6 overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]"
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
            <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--sr-text-muted)]">
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
          className="shrink-0 rounded-[var(--sr-radius-sm)] p-1 text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
        <ChevronDown
          size={18}
          aria-hidden
          className={`shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </div>

      {/* Metrics grid — always visible (key at-a-glance data) */}
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

      {/* Collapsed teaser — preview of the coach insight */}
      {!expanded && (
        <div className="px-4 pb-4 pt-1">
          <p className="text-sm leading-relaxed text-[var(--sr-text-secondary)]">
            {teaser(insight.body)}
          </p>
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-[var(--sr-brand-primary)]">
            {pl.coachWeeklyReportExpand} ↓
          </p>
        </div>
      )}

      {/* Expanded body — full coach insight + actions */}
      {expanded && (
        <div id={`weekly-report-body-${panelId}`} className="px-4 pb-4 pt-1">
          {regenerating ? (
            <p className="animate-pulse text-sm text-[var(--sr-text-muted)]">
              {pl.coachWeeklyReportRegenerating}
            </p>
          ) : (
            <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
              {insight.body}
            </p>
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
