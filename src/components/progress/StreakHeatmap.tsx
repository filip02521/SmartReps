import { useMemo } from 'react'
import { StreakFlame } from '@/components/dashboard/StreakFlame'
import { format } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { pl } from '@/i18n/pl'
import { startOfLocalWeek, getWeekKey, computeStreakWeeks } from '@/lib/stats-engine'
import { useFrozenWeeks } from '@/lib/streak-freeze'
import type { LocalWorkoutSession } from '@/lib/db'
import { cn } from '@/lib/utils'

type WeekCell = {
  weekKey: string
  weekStart: Date
  label: string
  monthLabel: string | null
  sessions: number
  reps: number
  isCurrent: boolean
  isFrozen: boolean
}

function buildWeekCells(
  sessions: LocalWorkoutSession[],
  frozenWeeks: ReadonlySet<string>,
  weeks = 12,
): WeekCell[] {
  const now = new Date()
  const currentWeekStart = startOfLocalWeek(now)
  const currentWeekKey = getWeekKey(now)

  // Build week map: weekKey → { sessions, reps }
  const weekMap = new Map<string, { sessions: number; reps: number }>()
  for (const s of sessions) {
    if (s.status !== 'completed') continue
    const key = getWeekKey(new Date(s.completedAt ?? s.startedAt))
    const existing = weekMap.get(key) ?? { sessions: 0, reps: 0 }
    existing.sessions += 1
    existing.reps += s.totalReps ?? 0
    weekMap.set(key, existing)
  }

  const cells: WeekCell[] = []
  let lastMonth = -1
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart)
    weekStart.setDate(weekStart.getDate() - i * 7)
    const key = getWeekKey(weekStart)
    const data = weekMap.get(key)
    const month = weekStart.getMonth()
    // Show month label only on the first cell of a new month
    const monthLabel = month !== lastMonth ? format(weekStart, 'MMM', { locale: dateFnsLocale() }) : null
    lastMonth = month
    cells.push({
      weekKey: key,
      weekStart,
      label: format(weekStart, 'd MMM', { locale: dateFnsLocale() }),
      monthLabel,
      sessions: data?.sessions ?? 0,
      reps: data?.reps ?? 0,
      isCurrent: key === currentWeekKey,
      isFrozen: frozenWeeks.has(key),
    })
  }
  return cells
}

function cellColor(sessions: number, isFrozen: boolean): string {
  if (isFrozen) {
    return 'bg-[var(--sr-info-muted)] border-[color-mix(in_srgb,var(--sr-info)_45%,transparent)]'
  }
  if (sessions === 0) return 'bg-[var(--sr-bg-surface)] border-[var(--sr-border-subtle)]'
  if (sessions <= 3) return 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_30%,var(--sr-bg-surface))]'
  if (sessions <= 6) return 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_60%,var(--sr-bg-surface))]'
  return 'bg-[var(--sr-brand-primary)]'
}

export function StreakHeatmap({
  sessions,
  weeks = 12,
  compact = false,
  showHeader = true,
}: {
  sessions: LocalWorkoutSession[]
  weeks?: number
  compact?: boolean
  /** Show the title/hint header. Set false when embedded in a ProgressSection that already provides title+hint. */
  showHeader?: boolean
}) {
  const frozenWeeks = useFrozenWeeks()
  const cells = useMemo(
    () => buildWeekCells(sessions, frozenWeeks, weeks),
    [sessions, frozenWeeks, weeks],
  )
  const streak = useMemo(
    () =>
      computeStreakWeeks(
        sessions.filter((s) => s.status === 'completed'),
        new Date(),
        frozenWeeks,
      ),
    [sessions, frozenWeeks],
  )

  const hasData = cells.some((c) => c.sessions > 0 || c.isFrozen)
  if (!hasData) {
    return (
      <div>
        {showHeader && (
          <div className="flex items-center gap-2">
            <StreakFlame streak={0} size={16} />
            <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
              {pl.streakHeatmapTitle}
            </p>
          </div>
        )}
        <p className={cn('sr-text-body-sm text-[var(--sr-text-secondary)]', showHeader && 'mt-2')}>
          {pl.streakHeatmapEmpty}
        </p>
      </div>
    )
  }

  return (
    <div>
      {showHeader && (
        <>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StreakFlame streak={streak} size={compact ? 14 : 16} />
              <p className={cn('font-semibold text-[var(--sr-text-primary)]', compact ? 'text-xs' : 'sr-text-body-sm')}>
                {pl.streakHeatmapTitle}
              </p>
            </div>
            <p className={cn('font-semibold text-[var(--sr-brand-primary)]', compact ? 'text-xs' : 'sr-text-body-sm')}>
              {pl.streakHeatmapWeeksStreak(streak)}
            </p>
          </div>
          {!compact && (
            <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.streakHeatmapHint}
            </p>
          )}
        </>
      )}

      {/* Month labels (full mode only) */}
      {!compact && (
        <div className={cn('flex gap-1 text-[10px] text-[var(--sr-text-muted)]', showHeader && 'mt-2')}>
          {cells.map((cell) => (
            <div key={cell.weekKey} className="w-6 text-center leading-none">
              {cell.monthLabel ?? ''}
            </div>
          ))}
        </div>
      )}

      <div
        role="img"
        aria-label={pl.streakHeatmapMiniAria(streak)}
        className={cn(
          'flex',
          compact ? 'gap-1.5' : 'gap-1',
          showHeader && (compact ? 'mt-2' : 'mt-1'),
        )}
      >
        {cells.map((cell) => (
          <div
            key={cell.weekKey}
            title={
              cell.isFrozen
                ? pl.streakFreezeCellTitle(cell.label)
                : pl.streakHeatmapCellAria(cell.sessions, cell.reps, cell.label)
            }
            className={cn(
              'rounded-[var(--sr-radius-sm)] border transition-colors',
              compact ? 'h-4 w-4 flex-1' : 'h-6 w-6',
              cellColor(cell.sessions, cell.isFrozen),
              cell.isCurrent && 'ring-2 ring-[var(--sr-brand-primary)] ring-offset-1 ring-offset-[var(--sr-bg-elevated)]',
            )}
          />
        ))}
      </div>

      {/* Legend (full mode only) */}
      {!compact && (
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-[var(--sr-text-muted)]">
          <span>{pl.streakHeatmapLegendNone}</span>
          <div className="flex gap-0.5">
            <div className={cn('h-2.5 w-2.5 rounded-[var(--sr-radius-sm)] border', cellColor(0, false))} />
            <div className={cn('h-2.5 w-2.5 rounded-[var(--sr-radius-sm)] border', cellColor(2, false))} />
            <div className={cn('h-2.5 w-2.5 rounded-[var(--sr-radius-sm)] border', cellColor(5, false))} />
            <div className={cn('h-2.5 w-2.5 rounded-[var(--sr-radius-sm)] border', cellColor(8, false))} />
          </div>
          <span>{pl.streakHeatmapLegendHigh}</span>
          {frozenWeeks.size > 0 && (
            <span className="ml-2 flex items-center gap-1">
              <span className={cn('h-2.5 w-2.5 rounded-[var(--sr-radius-sm)] border', cellColor(0, true))} />
              {pl.streakFreezeLegend}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
