import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import type { HeatmapCell } from '@/lib/export'

const colors: Record<HeatmapCell['status'], string> = {
  passed: 'bg-[var(--sr-success)]',
  failed: 'bg-[var(--sr-error)]',
  rest: 'bg-[var(--sr-bg-surface)] ring-1 ring-inset ring-[var(--sr-border-subtle)]',
  empty: 'bg-[var(--sr-bg-surface)]/40',
}

export function ActivityHeatmap({
  grid,
  showSummary = true,
}: {
  grid: HeatmapCell[][]
  showSummary?: boolean
}) {
  const workoutCount = grid.flat().filter((c) => c.status === 'passed' || c.status === 'failed').length
  const weeks = grid.length

  return (
    <div>
      {showSummary && (
        <p className="mb-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {workoutCount > 0 ? pl.heatmapSummary(workoutCount, weeks) : pl.progressHeatmapEmpty}
        </p>
      )}
      <div className="overflow-x-auto" role="img" aria-label={pl.heatmapSummary(workoutCount, weeks)}>
        <div className="flex w-full min-w-0 flex-col gap-1">
          {grid.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  title={cell.detail ? `${cell.label}: ${cell.detail}` : cell.label}
                  aria-label={cell.detail ? `${cell.label}: ${cell.detail}` : cell.label}
                  className={cn('aspect-square min-h-4 w-full rounded-[3px]', colors[cell.status])}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sr-success)]" /> {pl.passedShort}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sr-error)]" /> {pl.failedShort}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--sr-bg-surface)] ring-1 ring-[var(--sr-border-subtle)]" /> {pl.rest}</span>
      </div>
    </div>
  )
}
