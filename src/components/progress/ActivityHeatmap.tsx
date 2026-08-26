import { cn } from '@/lib/utils'
import type { HeatmapCell } from '@/lib/export'

const colors: Record<HeatmapCell['status'], string> = {
  passed: 'bg-[var(--sr-success)]',
  failed: 'bg-[var(--sr-error)]',
  rest: 'bg-[var(--sr-bg-surface)]',
  empty: 'bg-[var(--sr-bg-surface)]/40',
}

export function ActivityHeatmap({ grid }: { grid: HeatmapCell[][] }) {
  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        {grid.map((week, wi) => (
          <div key={wi} className="flex gap-1">
            {week.map((cell) => (
              <div
                key={cell.date}
                title={cell.detail ? `${cell.label}: ${cell.detail}` : cell.label}
                className={cn('h-3 w-3 rounded-sm', colors[cell.status])}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-[var(--sr-text-muted)]">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--sr-success)]" /> Trening OK</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--sr-error)]" /> Nieudany</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-[var(--sr-bg-surface)]" /> Przerwa</span>
      </div>
    </div>
  )
}
