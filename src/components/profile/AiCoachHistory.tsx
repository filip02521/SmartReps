import { useEffect, useId, useState, useCallback } from 'react'
import {
  ChevronDown,
  MessageSquareOff,
  Check,
  ArrowUpRight,
  Sparkles,
  Dumbbell,
  CalendarRange,
  AlertTriangle,
} from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { Button } from '@/components/ui/Button'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { pl } from '@/i18n/pl'
import { db, type LocalAiInsight, type AiInsightType } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { parseCoachBody, coachBodyPreview, hasCoachSections } from '@/lib/coach-body'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

type FilterType = 'all' | AiInsightType

const FILTERS: FilterType[] = ['all', 'post_workout', 'weekly_report', 'plateau_warning']

// Resolved at render — a module-level pl.* map would freeze the dict active
// at import, so labels wouldn't follow a language switch.
function filterLabel(key: FilterType): string {
  switch (key) {
    case 'post_workout': return pl.coachHistoryFilterPostWorkout
    case 'weekly_report': return pl.coachHistoryFilterWeekly
    case 'plateau_warning': return pl.coachHistoryFilterPlateau
    default: return pl.coachHistoryFilterAll
  }
}

/** Relative time formatter — "2 dni temu" / "3 h ago". */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return pl.coachHistoryAgoNow
  const min = Math.floor(ms / 60_000)
  if (min < 60) return pl.coachHistoryAgoMinutes(min)
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return pl.coachHistoryAgoHours(hrs)
  const days = Math.floor(hrs / 24)
  if (days < 7) return pl.coachHistoryAgoDays(days)
  return pl.coachHistoryAgoWeeks(Math.floor(days / 7))
}

const TYPE_TONE: Record<AiInsightType, 'insight' | 'warning' | 'success'> = {
  post_workout: 'insight',
  weekly_report: 'insight',
  plateau_warning: 'warning',
}

const TYPE_ICON: Record<AiInsightType, typeof Dumbbell> = {
  post_workout: Dumbbell,
  weekly_report: CalendarRange,
  plateau_warning: AlertTriangle,
}

/** How many insights render before the "show older" affordance appears. */
const INITIAL_VISIBLE = 5

export function AiCoachHistory() {
  const panelId = useId()
  const [insights, setInsights] = useState<LocalAiInsight[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      // Load AI insights + local plateau warnings (persistent, high-signal).
      // Other local insights are cheap and ephemeral — not worth listing.
      const all = await db.aiInsights
        .orderBy('createdAt')
        .reverse()
        .filter((i) => i.source === 'ai' || i.type === 'plateau_warning')
        .toArray()
      setInsights(all)
    } catch {
      setInsights([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = filter === 'all' ? insights : insights.filter((i) => i.type === filter)
  const visible = showAll ? filtered : filtered.slice(0, INITIAL_VISIBLE)
  const hiddenCount = filtered.length - visible.length

  function handleFilterChange(next: FilterType) {
    setFilter(next)
    setExpanded(null)
    setShowAll(false)
  }

  async function handleDismiss(insight: LocalAiInsight) {
    const dismissed = { ...insight, dismissedAt: new Date().toISOString() }
    await db.aiInsights.put(dismissed)
    void enqueueSync('ai_insights', 'update', dismissed)
    setInsights((prev) => prev.map((i) => (i.id === insight.id ? dismissed : i)))
    showToast(pl.coachHistoryDismissed, 'info')
  }

  return (
    <div className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <AiCoachMark size="sm" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight text-[var(--sr-text-primary)]">
            {pl.coachHistoryTitle}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--sr-text-secondary)]">
            {pl.coachHistoryHint}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {FILTERS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => handleFilterChange(key)}
            className={cn(
              FOCUS_RING,
              'min-h-9 rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === key
                ? 'bg-[var(--sr-brand-primary)] text-white'
                : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)] hover:bg-[var(--sr-border-subtle)]',
            )}
          >
            {filterLabel(key)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-3 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <BrandLoader size={28} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-center">
            <MessageSquareOff size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
            <p className="text-sm text-[var(--sr-text-muted)]">
              {pl.coachHistoryEmpty}
            </p>
          </div>
        ) : (
          <>
            {visible.map((insight) => {
              const isExpanded = expanded === insight.id
              const tone = TYPE_TONE[insight.type] ?? 'insight'
              const TypeIcon = TYPE_ICON[insight.type] ?? Dumbbell
              // Preview: first summary line for structured bodies, raw text
              // (line-clamped) for plain ones — never the raw ✓/→/💡 markers.
              const preview = hasCoachSections(insight.body)
                ? coachBodyPreview(insight.body)
                : insight.body.replace(/\s+/g, ' ').trim()
              const bodyId = `coach-insight-${panelId}-${insight.id}`
              return (
                <div
                  key={insight.id}
                  className={cn(
                    'rounded-[var(--sr-radius-md)] border bg-[var(--sr-bg-surface)] p-3',
                    insight.dismissedAt
                      ? 'border-[var(--sr-border-subtle)] opacity-60'
                      : tone === 'warning'
                        ? 'border-[var(--sr-warning)]/30'
                        : 'border-[var(--sr-border-subtle)]',
                  )}
                >
                  {/* Header row — type icon, title, preview, time */}
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : insight.id)}
                    aria-expanded={isExpanded}
                    aria-controls={bodyId}
                    className={cn(FOCUS_RING, 'flex w-full items-start gap-2.5 rounded-[var(--sr-radius-sm)] text-left')}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        tone === 'warning'
                          ? 'bg-[var(--sr-warning-muted)] text-[var(--sr-warning)]'
                          : 'bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_50%,transparent)] text-[var(--sr-brand-primary)]',
                      )}
                    >
                      <TypeIcon size={14} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold leading-snug text-[var(--sr-text-primary)]">
                        {insight.title}
                      </span>
                      <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
                        {insight.dismissedAt
                          ? pl.coachHistoryDismissedAgo(relativeTime(insight.dismissedAt))
                          : relativeTime(insight.createdAt)}
                      </p>
                      {!isExpanded && preview && (
                        <p className="mt-1 line-clamp-2 text-xs leading-snug text-[var(--sr-text-secondary)]">
                          {preview}
                        </p>
                      )}
                    </div>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={cn(
                        'mt-1 shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200',
                        isExpanded && 'rotate-180',
                      )}
                    />
                  </button>

                  {/* Body — structured sections when markers present, else the
                      plain text. Full content stays reachable on expand. */}
                  {isExpanded && (
                    <div id={bodyId} className="mt-2.5 border-t border-[var(--sr-border-subtle)] pt-2.5">
                      <InsightBody body={insight.body} />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
                          {insight.source === 'ai' ? pl.coachSourceAi : pl.coachSourceLocal}
                        </span>
                        {!insight.dismissedAt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleDismiss(insight)}
                          >
                            {pl.coachHistoryDismiss}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={cn(
                  FOCUS_RING,
                  'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[var(--sr-radius-md)] border border-dashed border-[var(--sr-border-subtle)] text-xs font-semibold text-[var(--sr-brand-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_20%,transparent)]',
                )}
              >
                <ChevronDown size={14} aria-hidden />
                {pl.coachHistoryShowOlder(hiddenCount)}
              </button>
            )}
            {showAll && filtered.length > INITIAL_VISIBLE && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                className={cn(
                  FOCUS_RING,
                  'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[var(--sr-radius-md)] text-xs font-medium text-[var(--sr-text-muted)] transition-colors hover:text-[var(--sr-text-primary)]',
                )}
              >
                <ChevronDown size={14} aria-hidden className="rotate-180" />
                {pl.coachHistoryShowFewer}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** Expanded insight body — parses ✓/→/💡 markers into labelled sections
 *  (same visual language as WeeklyReportCard); plain bodies render as-is. */
function InsightBody({ body }: { body: string }) {
  const parsed = parseCoachBody(body)
  const structured =
    parsed.strengths.length > 0 ||
    parsed.improvements.length > 0 ||
    parsed.recommendation != null

  if (!structured) {
    return (
      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
        {body}
      </p>
    )
  }

  return (
    <div>
      {parsed.summary && (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
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
    </div>
  )
}
