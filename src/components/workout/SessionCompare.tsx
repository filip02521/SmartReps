import { Card } from '@/components/ui/Card'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import { formatSetTarget } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'
import type { SetResultDraft } from '@/lib/progress-engine'

export function SessionCompare({
  rows,
  previousRows,
  totalReps,
  previousTotalReps,
}: {
  rows: SetResultDraft[]
  previousRows?: SetResultDraft[]
  totalReps: number
  previousTotalReps?: number | null
}) {
  const totalDelta =
    previousTotalReps != null && previousTotalReps > 0
      ? totalReps - previousTotalReps
      : null

  return (
    <>
      <Card className="overflow-x-auto sr-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[var(--sr-text-muted)]">
              <th className="pb-2">Seria</th>
              <th className="pb-2">Cel</th>
              <th className="pb-2">Ty</th>
              <th className="pb-2">{pl.prevColumn}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const prev = previousRows?.find((p) => p.setNumber === r.setNumber)
              const diff = prev ? r.actual - prev.actual : null
              return (
                <tr key={r.setNumber} className="border-t border-[var(--sr-border-subtle)]">
                  <td className="py-2">{r.setNumber}</td>
                  <td className="py-2">{formatSetTarget(r.target)}</td>
                  <td className="py-2 tabular-nums">{r.actual}</td>
                  <td className="py-2 tabular-nums text-[var(--sr-text-muted)]">
                    {prev ? (
                      <>
                        {prev.actual}{' '}
                        <TrendIndicator delta={diff} />
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      <p className="mt-4 text-center text-[var(--sr-text-secondary)]">
        {pl.totalReps}: <span className="font-semibold text-[var(--sr-text-primary)]">{totalReps}</span>
        {totalDelta !== null && totalDelta !== 0 && (
          <span className="ml-2 text-sm text-[var(--sr-success)]">
            {pl.totalRepsDelta(totalDelta)}
          </span>
        )}
      </p>
    </>
  )
}
