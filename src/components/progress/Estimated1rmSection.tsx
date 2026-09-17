import { useMemo } from 'react'
import { pl } from '@/i18n/pl'
import { Card } from '@/components/ui/Card'
import { estimate1rm } from '@/lib/exercise-model'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import { dateBcp47 } from '@/lib/date-locale'
import type { LocalWorkoutSession } from '@/lib/db'

type Exercise1rm = {
  exerciseId: string
  exerciseName: string
  best1rm: number
  reps: number
  weightKg: number
  date: string
}

/** Localized weight display — whole lbs (convention), ≤1 decimal for kg. */
function fmtWeight(kg: number, unit: 'kg' | 'lb'): string {
  return kgToDisplay(kg, unit).toLocaleString(dateBcp47(), {
    maximumFractionDigits: unit === 'kg' ? 1 : 0,
  })
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(dateBcp47(), {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: '2-digit' }),
  })
}

export function Estimated1rmSection({
  sessions,
  exerciseMap,
  weightUnit = 'kg',
}: {
  sessions: LocalWorkoutSession[]
  exerciseMap: Map<string, { name: string }>
  weightUnit?: 'kg' | 'lb'
}) {
  const estimates = useMemo(() => {
    const byExercise = new Map<string, Exercise1rm>()

    for (const session of sessions) {
      if (session.status !== 'completed') continue
      const logs = session.exerciseLogs ?? []
      for (const log of logs) {
        // Deleted exercises keep their history — fall back to a generic name
        // instead of silently dropping the row.
        const name = exerciseMap.get(log.exerciseId)?.name ?? pl.exerciseFallbackName
        // Only exercises with weight (reps_weight metric)
        for (const set of log.sets) {
          const reps = set.actual.reps ?? 0
          const kg = set.actual.weightKg ?? 0
          if (reps <= 0 || kg <= 0) continue
          const est = estimate1rm(kg, reps)
          if (est <= 0) continue
          const existing = byExercise.get(log.exerciseId)
          if (!existing || est > existing.best1rm) {
            byExercise.set(log.exerciseId, {
              exerciseId: log.exerciseId,
              exerciseName: name,
              best1rm: est,
              reps,
              weightKg: kg,
              date: session.completedAt ?? session.startedAt,
            })
          }
        }
      }
    }

    return Array.from(byExercise.values()).sort((a, b) => b.best1rm - a.best1rm).slice(0, 10)
  }, [sessions, exerciseMap])

  if (estimates.length === 0) {
    return (
      <Card className="p-4">
        <p className="sr-text-body-sm text-[var(--sr-text-muted)]">{pl.est1rmEmpty}</p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left sr-text-overline text-[var(--sr-text-muted)]">
              <th className="pb-2 font-semibold">{pl.est1rmExercise}</th>
              <th className="pb-2 text-right font-semibold">{pl.est1rmValue}</th>
              <th className="hidden pb-2 text-right font-semibold sm:table-cell">{pl.est1rmWeight}</th>
              <th className="hidden pb-2 text-right font-semibold sm:table-cell">{pl.est1rmReps}</th>
              <th className="hidden pb-2 text-right font-semibold sm:table-cell">{pl.est1rmDate}</th>
            </tr>
          </thead>
          <tbody>
            {estimates.map((e) => (
              <tr
                key={e.exerciseId}
                className="border-t border-[var(--sr-border-subtle)]"
              >
                <td className="py-2 font-medium text-[var(--sr-text-primary)]">
                  {e.exerciseName}
                  {/* Date under the name on mobile where the column is hidden —
                      staleness matters: a 1RM from months ago reads differently
                      than last week's. */}
                  <span className="block text-[11px] font-normal text-[var(--sr-text-muted)] sm:hidden">
                    {fmtDate(e.date)}
                  </span>
                </td>
                <td className="py-2 text-right text-base font-bold tabular-nums text-[var(--sr-brand-primary)]">
                  {fmtWeight(e.best1rm, weightUnit)}
                  <span className="ml-1 text-xs font-normal text-[var(--sr-text-muted)]">
                    {weightUnitLabel(weightUnit)}
                  </span>
                </td>
                <td className="hidden py-2 text-right tabular-nums text-[var(--sr-text-muted)] sm:table-cell">
                  {fmtWeight(e.weightKg, weightUnit)}
                </td>
                <td className="hidden py-2 text-right tabular-nums text-[var(--sr-text-muted)] sm:table-cell">
                  {e.reps}
                </td>
                <td className="hidden py-2 text-right tabular-nums text-[var(--sr-text-muted)] sm:table-cell">
                  {fmtDate(e.date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
