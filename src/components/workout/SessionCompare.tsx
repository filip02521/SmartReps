import { Card } from '@/components/ui/Card'
import { NestedStat } from '@/components/ui/NestedStat'
import { TrendIndicator } from '@/components/ui/TrendIndicator'
import {
  SessionSummaryHighlights,
  SummaryInsightBadge,
} from '@/components/workout/SessionSummaryHighlights'
import { formatSetTarget } from '@/lib/progress-engine'
import {
  formatBuiltinSetInsightBadge,
  type BuiltinSessionInsights,
} from '@/lib/session-summary-insights'
import { pl } from '@/i18n/pl'
import type { SetResultDraft } from '@/lib/progress-engine'

export function SessionCompare({
  rows,
  previousRows,
  totalReps,
  previousTotalReps,
  insights,
}: {
  rows: SetResultDraft[]
  previousRows?: SetResultDraft[]
  totalReps: number
  previousTotalReps?: number | null
  insights?: BuiltinSessionInsights
}) {
  const totalDelta =
    previousTotalReps != null && previousTotalReps > 0
      ? totalReps - previousTotalReps
      : null

  return (
    <>
      {insights && <SessionSummaryHighlights highlights={insights.highlights} />}

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
              const setInsight = insights?.setInsights.get(r.setNumber)
              const badge = formatBuiltinSetInsightBadge(setInsight)
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
                  <td
                    className={`py-2.5 text-base font-semibold tabular-nums ${
                      r.passed ? 'text-[var(--sr-text-primary)]' : 'text-[var(--sr-error)]'
                    }`}
                  >
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {r.actual}
                      {badge && setInsight?.kind === 'pr' && (
                        <SummaryInsightBadge tone="pr">{badge}</SummaryInsightBadge>
                      )}
                      {badge && setInsight?.kind === 'improved' && (
                        <SummaryInsightBadge tone="progress">{badge}</SummaryInsightBadge>
                      )}
                    </span>
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
