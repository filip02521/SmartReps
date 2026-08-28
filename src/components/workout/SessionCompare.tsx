import { Card } from '@/components/ui/Card'
import { NestedStat } from '@/components/ui/NestedStat'
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
      <div className="mb-4 grid grid-cols-2 gap-2">
        <NestedStat
          size="lg"
          highlight
          overline={pl.totalReps}
          value={totalReps}
          hint={
            totalDelta !== null && totalDelta !== 0
              ? pl.totalRepsDelta(totalDelta)
              : previousTotalReps != null
                ? pl.summaryUnchanged
                : undefined
          }
        />
        <NestedStat
          size="lg"
          overline={pl.setColumn}
          value={`${rows.filter((r) => r.passed).length}/${rows.length}`}
          hint={pl.summarySetsPassed}
        />
      </div>

      <Card className="overflow-x-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left sr-text-overline text-[var(--sr-text-muted)]">
              <th className="pb-2.5 font-semibold">{pl.setColumn}</th>
              <th className="pb-2.5 font-semibold">{pl.targetColumn}</th>
              <th className="pb-2.5 font-semibold">{pl.youColumn}</th>
              <th className="pb-2.5 font-semibold">{pl.prevColumn}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const prev = previousRows?.find((p) => p.setNumber === r.setNumber)
              const diff = prev ? r.actual - prev.actual : null
              return (
                <tr
                  key={r.setNumber}
                  className={
                    idx % 2 === 0
                      ? 'border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/40'
                      : 'border-t border-[var(--sr-border-subtle)]'
                  }
                >
                  <td className="py-2.5 font-medium text-[var(--sr-text-secondary)]">{r.setNumber}</td>
                  <td className="py-2.5 tabular-nums text-[var(--sr-text-secondary)]">
                    {formatSetTarget(r.target)}
                  </td>
                  <td className="py-2.5 text-base font-semibold tabular-nums text-[var(--sr-text-primary)]">
                    {r.actual}
                  </td>
                  <td className="py-2.5 tabular-nums text-[var(--sr-text-muted)]">
                    {prev ? (
                      <span className="inline-flex items-center gap-1">
                        {prev.actual}
                        <TrendIndicator delta={diff} />
                      </span>
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
    </>
  )
}
