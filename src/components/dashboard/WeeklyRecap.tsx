import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { WeeklyRecap } from '@/lib/weekly-recap'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

function deltaLabel(delta: number): string {
  if (delta > 0) return pl.weeklyRecapDeltaUp(delta)
  if (delta < 0) return pl.weeklyRecapDeltaDown(Math.abs(delta))
  return pl.weeklyRecapDeltaSame
}

function recapDetails(recap: WeeklyRecap): string {
  const parts = [deltaLabel(recap.deltaSessionsVsPrevWeek)]
  if (recap.streakWeeks > 0) {
    parts.push(pl.weeklyRecapCurrentStreak(recap.streakWeeks))
  }
  if (recap.bestStreakWeeks > recap.streakWeeks) {
    parts.push(pl.weeklyRecapBestStreak(recap.bestStreakWeeks))
  }
  return parts.join(' · ')
}

export function WeeklyRecapPanel({ recap }: { recap: WeeklyRecap }) {
  const [collapsed, setCollapsed] = useState(true)
  const hasActivity = recap.sessionsThisWeek > 0

  return (
    <section className="mt-4" aria-label={pl.weeklyRecapTitle}>
      <button
        type="button"
        className={cn(
          'flex min-h-11 w-full items-center justify-between gap-2 rounded-[var(--sr-radius-md)] text-left',
          FOCUS_RING,
        )}
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="sr-text-overline text-[var(--sr-text-muted)]">{pl.weeklyRecapTitle}</span>
        <span className="flex items-center gap-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {collapsed && hasActivity && (
            <span className="tabular-nums">
              {pl.weeklyRecapCollapsedHint(recap.sessionsThisWeek, recap.repsThisWeek)}
            </span>
          )}
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-2 space-y-1 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] px-3 py-3">
          <p className="sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
            {hasActivity
              ? pl.weeklyRecapLine(recap.sessionsThisWeek, recap.repsThisWeek)
              : pl.weeklyRecapEmpty}
          </p>
          {hasActivity && (
            <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
              {recapDetails(recap)}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
