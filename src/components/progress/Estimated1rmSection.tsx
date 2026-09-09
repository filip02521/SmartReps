import { useMemo } from 'react'
import { pl } from '@/i18n/pl'
import { Card } from '@/components/ui/Card'
import { estimate1rm } from '@/lib/exercise-model'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import type { LocalWorkoutSession } from '@/lib/db'

type Exercise1rm = {
  exerciseId: string
  exerciseName: string
  best1rm: number
  reps: number
  weightKg: number
  date: string
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
        const def = exerciseMap.get(log.exerciseId)
        if (!def) continue
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
              exerciseName: def.name,
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
        <h3 className="mb-1 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
          {pl.est1rmTitle}
        </h3>
        <p className="sr-text-body-sm text-[var(--sr-text-muted)]">{pl.est1rmEmpty}</p>
      </Card>
    )
  }

  return (
    <Card className="p-4">
      <h3 className="mb-1 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
        {pl.est1rmTitle}
      </h3>
      <p className="mb-3 text-xs text-[var(--sr-text-muted)]">{pl.est1rmHint}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left sr-text-overline text-[var(--sr-text-muted)]">
              <th className="pb-2 font-semibold">{pl.est1rmExercise}</th>
              <th className="pb-2 text-right font-semibold">{pl.est1rmValue}</th>
              <th className="hidden pb-2 text-right font-semibold sm:table-cell">{pl.est1rmWeight}</th>
              <th className="hidden pb-2 text-right font-semibold sm:table-cell">{pl.est1rmReps}</th>
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
                </td>
                <td className="py-2 text-right text-base font-bold tabular-nums text-[var(--sr-brand-primary)]">
                  {kgToDisplay(e.best1rm, weightUnit)}
                  <span className="ml-1 text-xs font-normal text-[var(--sr-text-muted)]">
                    {weightUnitLabel(weightUnit)}
                  </span>
                </td>
                <td className="hidden py-2 text-right tabular-nums text-[var(--sr-text-muted)] sm:table-cell">
                  {kgToDisplay(e.weightKg, weightUnit)}
                </td>
                <td className="hidden py-2 text-right tabular-nums text-[var(--sr-text-muted)] sm:table-cell">
                  {e.reps}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
