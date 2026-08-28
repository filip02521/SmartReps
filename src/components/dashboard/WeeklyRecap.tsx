import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { WeeklyRecap } from '@/lib/weekly-recap'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

function deltaLabel(delta: number): string {
  if (delta > 0) return pl.weeklyRecapDeltaUp(delta)
  if (delta < 0) return pl.weeklyRecapDeltaDown(Math.abs(delta))
  return pl.weeklyRecapDeltaSame
}

export function WeeklyRecapPanel({ recap }: { recap: WeeklyRecap }) {
  const collapsedDefault = recap.sessionsThisWeek === 0
  const [collapsed, setCollapsed] = useState(collapsedDefault)

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
          {collapsed && recap.sessionsThisWeek > 0 && (
            <span className="tabular-nums">
              {pl.weeklyRecapCollapsedHint(recap.sessionsThisWeek, recap.repsThisWeek)}
            </span>
          )}
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </span>
      </button>

      {!collapsed && (
        <div className="mt-2">
          <MetricStrip
            metrics={[
              { value: recap.sessionsThisWeek, label: pl.weeklyRecapSessions },
              { value: recap.repsThisWeek, label: pl.weeklyRecapReps },
              { value: recap.streakWeeks, label: pl.streakWeeks },
            ]}
          />
          <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {deltaLabel(recap.deltaSessionsVsPrevWeek)}
            {recap.bestStreakWeeks > 0 && (
              <>
                {' · '}
                {pl.weeklyRecapBestStreak(recap.bestStreakWeeks)}
              </>
            )}
          </p>
          {recap.sessionsThisWeek === 0 && (
            <p className="mt-1 sr-text-body-sm text-[var(--sr-text-muted)]">{pl.weeklyRecapEmpty}</p>
          )}
        </div>
      )}
    </section>
  )
}
