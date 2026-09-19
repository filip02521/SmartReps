import { useId, useRef, useState } from 'react'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import { StreakFlame, streakFlameColor } from '@/components/dashboard/StreakFlame'
import type { LocalAiInsight } from '@/lib/db'
import {
  X,
  Calendar,
  CalendarX,
  Check,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Minus,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Clock,
  Trophy,
  Layers,
} from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { coachBodyPreview, parseCoachBody } from '@/lib/coach-body'
import { format, formatDistanceToNow } from 'date-fns'
import { dateFnsLocale, dateBcp47 } from '@/lib/date-locale'

type WeeklyMetrics = {
  sessions: number
  totalReps: number
  totalVolume?: number
  trainingDays?: number
  avgDurationMin?: number
  prCount?: number
  streakWeeks: number
  repsWeekChangePct: number | null
  /** Rep buckets per weekday, Monday-first (7 entries). Added with the
   *  activity chart — absent in reports generated before this field. */
  dailyReps?: number[]
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

// parseCoachBody lives in @/lib/coach-body — shared with AiCoachHistory.

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

/** Fallback teaser for legacy rows without structured metrics (pre-metricsJson). */
function teaser(body: string, maxLen = 120): string {
  const single = body.replace(/\s+/g, ' ').trim()
  if (single.length <= maxLen) return single
  return `${single.slice(0, maxLen).trimEnd()}…`
}

/** Compact number formatting (e.g. 12 400 → 12.4k). */
function formatCompact(value: number): string {
  if (value >= 10000) return `${(value / 1000).toFixed(1)}k`
  return value.toLocaleString(dateBcp47())
}

/** Mon-first 7-day activity chart. Pure visual — meaning carried by the
 *  surrounding text; the region gets a single aria-label. */
function WeekChart({ dailyReps }: { dailyReps: number[] }) {
  const max = Math.max(...dailyReps, 1)
  const labels = pl.progressWeekdayLabels
  return (
    <div aria-label={pl.coachWeeklyChartAria} role="img" className="mt-3">
      <div className="flex h-12 items-end gap-1.5">
        {dailyReps.map((reps, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            <div
              className={cn(
                'w-full rounded-[var(--sr-radius-sm)]',
                reps > 0
                  ? 'bg-[image:var(--sr-brand-gradient)]'
                  : 'bg-[var(--sr-border-subtle)]',
              )}
              style={{ height: reps > 0 ? `${Math.max(14, (reps / max) * 100)}%` : '4px' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1.5">
        {labels.map((day, i) => (
          <span
            key={day + i}
            className={cn(
              'flex-1 text-center text-[9px] font-medium uppercase tracking-wide',
              dailyReps[i] > 0 ? 'text-[var(--sr-text-secondary)]' : 'text-[var(--sr-text-muted)]/60',
            )}
          >
            {day}
          </span>
        ))}
      </div>
    </div>
  )
}

/** Shown before any report exists yet, while the first one is being generated.
 *  Owned by the card module so the loading chrome always matches the real card. */
export function WeeklyReportSkeleton() {
  return (
    <div
      aria-busy
      aria-live="polite"
      aria-label={pl.coachWeeklyReportGenerating}
      className="sr-coach-msg-in overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]"
    >
      <div className="flex items-center gap-3 border-b border-[var(--sr-border-subtle)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_30%,transparent)] p-4">
        <AiCoachMark size="sm" pulse />
        <p className="animate-pulse text-xs text-[var(--sr-text-muted)]">
          {pl.coachWeeklyReportGenerating}
        </p>
      </div>
      <div className="flex items-end gap-1.5 p-4">
        {[40, 65, 90, 55, 30, 8, 8].map((h, i) => (
          <div key={i} className="flex h-12 flex-1 items-end">
            <div
              className="relative w-full overflow-hidden rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)]"
              style={{ height: `${h}%` }}
            >
              <div className="absolute inset-0 sr-skeleton-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function WeeklyReportCard({
  insight,
  onDismissed,
  onConnectAi,
  connectLabel,
  onRegenerate,
  regenerating = false,
}: {
  insight: LocalAiInsight
  onDismissed?: () => void
  onConnectAi?: () => void
  /** Override for the connect button label — e.g. "upgrade to AI" copy for
   *  Pro users who already have access (default: unlock-Pro hint). */
  connectLabel?: string
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
  // A week with zero sessions gets a materially different, much simpler card —
  // no point showing a grid of zero-value tiles. `tone` is a fallback for
  // legacy rows saved before metricsJson existed.
  const isEmptyWeek = metrics ? metrics.sessions === 0 : insight.tone === 'warning'
  const changePct = metrics?.repsWeekChangePct
  const trendUp = changePct != null && changePct > 0
  const trendDown = changePct != null && changePct < 0
  const trendIcon = trendUp
    ? <TrendingUp size={15} aria-hidden />
    : trendDown
      ? <TrendingDown size={15} aria-hidden />
      : <Minus size={15} aria-hidden />
  const trendLabel = trendUp
    ? `+${Math.round(changePct)}%`
    : trendDown
      ? `${Math.round(changePct)}%`
      : changePct === 0
        ? '0%'
        : pl.coachWeeklyTrendNone
  const trendAria =
    changePct == null
      ? pl.coachWeeklyReportFirstWeek
      : trendUp
        ? pl.coachWeeklyReportUp(Math.round(changePct))
        : trendDown
          ? pl.coachWeeklyReportDown(Math.abs(Math.round(changePct)))
          : pl.coachWeeklyMetricChange

  const updatedLabel = formatDistanceToNow(new Date(insight.createdAt), {
    addSuffix: true,
    locale: dateFnsLocale(),
  })

  const parsed = parseCoachBody(insight.body)

  // Header subtitle: a qualitative teaser of the coach's summary — the exact
  // numbers already live in the glance hero below, repeating them read as noise.
  const headerSubtitle = isEmptyWeek
    ? pl.coachWeeklyReportEmpty
    : teaser(coachBodyPreview(insight.body))

  const headerTitle = weekRange ?? insight.title
  const toggleAriaLabel = isNew
    ? pl.coachWeeklyReportNewAria
    : expanded
      ? pl.coachWeeklyReportCollapse
      : pl.coachWeeklyReportExpand

  // Detail strip — secondary stats, compact inline list. Volume only shown
  // when it differs from reps (calisthenics without weights logs equal values).
  const showVolume = metrics != null && metrics.totalVolume != null && metrics.totalVolume !== metrics.totalReps

  return (
    <section
      aria-live="polite"
      aria-label={pl.coachWeeklyReportSectionAria}
      className="sr-coach-msg-in overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]"
    >
      {/* Header — toggle button + sibling dismiss (no nested buttons). */}
      <div className="flex items-stretch border-b border-[var(--sr-border-subtle)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_30%,transparent)]">
        <button
          type="button"
          onClick={toggleExpand}
          aria-expanded={expanded}
          aria-controls={`weekly-report-body-${panelId}`}
          aria-label={toggleAriaLabel}
          className="flex min-w-0 flex-1 items-start gap-3 p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_20%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--sr-brand-primary)]"
        >
          <AiCoachMark size="sm" pulse={regenerating} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="min-w-0 break-words text-base font-bold leading-tight text-[var(--sr-text-primary)]">
                {headerTitle}
              </h3>
              {isNew && (
                <span
                  className="sr-new-badge inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--sr-brand-primary)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                  aria-hidden
                >
                  <span className="sr-new-badge-dot inline-block h-1.5 w-1.5 rounded-full bg-white" />
                  {pl.coachWeeklyReportNew}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-snug text-[var(--sr-text-secondary)]">
              {headerSubtitle}
            </p>
          </div>
          <ChevronDown
            size={18}
            aria-hidden
            className={cn(
              'mt-1 shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200',
              expanded && 'rotate-180',
            )}
          />
        </button>
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
          className="my-2 mr-2 flex min-h-12 min-w-12 shrink-0 items-center justify-center self-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Glance hero — the answer to "how was my week": verdict pill +
          summary line + per-day activity chart. Skipped for an empty week. */}
      {metrics && !isEmptyWeek && (
        <div className="px-4 pt-3.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none tabular-nums text-[var(--sr-text-primary)]">
                {formatCompact(metrics.totalReps)}
                <span className="ml-1.5 align-baseline text-sm font-semibold text-[var(--sr-text-muted)]">
                  {pl.coachWeeklyMetricReps.toLowerCase()}
                </span>
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--sr-text-secondary)]">
                <span className="inline-flex items-center gap-1">
                  <Calendar size={12} aria-hidden className="text-[var(--sr-text-muted)]" />
                  {pl.coachWeeklyHeroSessions(metrics.sessions)} · {pl.coachWeeklyHeroDays(metrics.trainingDays ?? 0)}
                </span>
                {metrics.streakWeeks > 0 && (
                  <span
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ color: streakFlameColor(metrics.streakWeeks) }}
                  >
                    <StreakFlame streak={metrics.streakWeeks} size={12} />
                    {pl.coachWeeklyHeroStreak(metrics.streakWeeks)}
                  </span>
                )}
              </p>
            </div>
            <span
              aria-label={trendAria}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums',
                trendUp && 'bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
                trendDown && 'bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
                !trendUp && !trendDown && 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
              )}
            >
              {trendIcon}
              {trendLabel}
            </span>
          </div>
          {metrics.dailyReps && <WeekChart dailyReps={metrics.dailyReps} />}
        </div>
      )}

      {/* Empty-week state — icon + encouragement, no numbers to show */}
      {isEmptyWeek && (
        <div className="flex items-center gap-2.5 px-4 pb-1 pt-3.5">
          <CalendarX size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
          <p className="text-sm leading-relaxed text-[var(--sr-text-secondary)]">
            {pl.coachWeeklyReportEmptyHeader}
          </p>
        </div>
      )}

      {/* Collapsed expand hint — points at the coach analysis below */}
      {!expanded && (
        <p className="mt-2 flex items-center gap-1 px-4 pb-4 text-[11px] font-medium text-[var(--sr-brand-primary)]">
          <ChevronDown size={12} aria-hidden />
          {pl.coachWeeklyReportExpandHint}
        </p>
      )}

      {/* Expanded body — structured coach analysis + detail stats + actions */}
      {expanded && (
        <div id={`weekly-report-body-${panelId}`} className="px-4 pb-4 pt-1">
          {regenerating ? (
            <div className="mt-2 rounded-[var(--sr-radius-sm)] border-l-2 border-[var(--sr-brand-primary)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_40%,var(--sr-bg-surface))] px-3 py-2.5">
              <p className="animate-pulse text-sm text-[var(--sr-text-muted)]">
                {pl.coachWeeklyReportRegenerating}
              </p>
            </div>
          ) : (
            <>
              {parsed.summary && (
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
                  {parsed.summary}
                </p>
              )}

              {parsed.strengths.length > 0 && (
                <div className="mt-3">
                  <p className="sr-text-overline mb-1.5 font-semibold uppercase tracking-wide text-[var(--sr-success)]">
                    {pl.coachWeeklySectionStrengths}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {parsed.strengths.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-snug text-[var(--sr-text-secondary)]">
                        <Check size={15} className="mt-0.5 shrink-0 text-[var(--sr-success)]" aria-hidden />
                        <span className="min-w-0">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parsed.improvements.length > 0 && (
                <div className="mt-3">
                  <p className="sr-text-overline mb-1.5 font-semibold uppercase tracking-wide text-[var(--sr-warning)]">
                    {pl.coachWeeklySectionImprovements}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {parsed.improvements.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-snug text-[var(--sr-text-secondary)]">
                        <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-[var(--sr-warning)]" aria-hidden />
                        <span className="min-w-0">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {parsed.recommendation && (
                <div className="mt-3 flex items-start gap-2.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary-muted)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_40%,var(--sr-bg-surface))] px-3 py-2.5">
                  <Sparkles size={15} className="mt-0.5 shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
                  <div className="min-w-0">
                    <p className="sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-brand-primary)]">
                      {pl.coachWeeklySectionRecommendation}
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-[var(--sr-text-primary)]">
                      {parsed.recommendation}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Detail stat strip — secondary metrics, compact inline */}
          {metrics && !isEmptyWeek && !regenerating && (
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--sr-text-secondary)]">
              <span className="inline-flex items-center gap-1">
                <Clock size={12} aria-hidden className="text-[var(--sr-text-muted)]" />
                {pl.coachWeeklyMetricDurationValue(metrics.avgDurationMin ?? 0)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Trophy size={12} aria-hidden className="text-[var(--sr-text-muted)]" />
                {(metrics.prCount ?? 0)} {pl.coachWeeklyMetricPrs.toLowerCase()}
              </span>
              {showVolume && (
                <span className="inline-flex items-center gap-1">
                  <Layers size={12} aria-hidden className="text-[var(--sr-text-muted)]" />
                  {formatCompact(metrics.totalVolume ?? 0)} {pl.coachWeeklyMetricVolume.toLowerCase()}
                </span>
              )}
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
                {connectLabel ?? pl.coachWeeklyReportConnectAiHint}
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
