import { useEffect, useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, MessageSquareOff } from 'lucide-react'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { db, type LocalAiInsight, type AiInsightType } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'

type FilterType = 'all' | AiInsightType

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: pl.coachHistoryFilterAll },
  { key: 'post_workout', label: pl.coachHistoryFilterPostWorkout },
  { key: 'weekly_report', label: pl.coachHistoryFilterWeekly },
  { key: 'plateau_warning', label: pl.coachHistoryFilterPlateau },
]

/** Relative time formatter — "2 dni temu", "3 godz. temu", "teraz". */
function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  if (ms < 60_000) return pl.coachHistoryCreatedAgo('teraz')
  const min = Math.floor(ms / 60_000)
  if (min < 60) return pl.coachHistoryCreatedAgo(`${min} min temu`)
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return pl.coachHistoryCreatedAgo(`${hrs} godz. temu`)
  const days = Math.floor(hrs / 24)
  if (days < 7) return pl.coachHistoryCreatedAgo(`${days} dni temu`)
  const weeks = Math.floor(days / 7)
  return pl.coachHistoryCreatedAgo(`${weeks} tyg. temu`)
}

const TYPE_TONE: Record<AiInsightType, 'insight' | 'warning' | 'success'> = {
  post_workout: 'insight',
  weekly_report: 'insight',
  plateau_warning: 'warning',
}

export function AiCoachHistory() {
  const [insights, setInsights] = useState<LocalAiInsight[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      // Load only AI-source insights, sorted by createdAt desc — most recent first.
      // Local insights are cheap, ephemeral, and not worth showing in history.
      const all = await db.aiInsights
        .orderBy('createdAt')
        .reverse()
        .filter((i) => i.source === 'ai')
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
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === f.key
                ? 'bg-[var(--sr-brand-primary)] text-white'
                : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)] hover:bg-[var(--sr-border-subtle)]',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="mt-3 flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--sr-border-subtle)] border-t-[var(--sr-brand-primary)]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-center">
            <MessageSquareOff size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
            <p className="text-sm text-[var(--sr-text-muted)]">
              {pl.coachHistoryEmpty}
            </p>
          </div>
        ) : (
          filtered.slice(0, 20).map((insight) => {
            const isExpanded = expanded === insight.id
            const tone = TYPE_TONE[insight.type] ?? 'insight'
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
                {/* Header row — title, time */}
                <button
                  type="button"
                  onClick={() => setExpanded(isExpanded ? null : insight.id)}
                  className="flex w-full items-start gap-2 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold text-[var(--sr-text-primary)]">
                      {insight.title}
                    </span>
                    <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
                      {insight.dismissedAt
                        ? pl.coachHistoryDismissedAgo(relativeTime(insight.dismissedAt))
                        : relativeTime(insight.createdAt)}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
                  ) : (
                    <ChevronDown size={16} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
                  )}
                </button>

                {/* Body — truncated when collapsed, full when expanded */}
                {isExpanded && (
                  <div className="mt-2">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--sr-text-secondary)]">
                      {insight.body}
                    </p>
                    {!insight.dismissedAt && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => void handleDismiss(insight)}
                      >
                        {pl.coachHistoryDismiss}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
