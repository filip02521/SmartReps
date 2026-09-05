import { useEffect, useMemo, useState } from 'react'
import { pl } from '@/i18n/pl'
import { db, type LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import { computeMuscleBalance, type MuscleBalance } from '@/lib/muscle-balance'
import { cn } from '@/lib/utils'

const OPTIMAL_SETS = 10

function statusColor(status: MuscleBalance['status']): string {
  switch (status) {
    case 'optimal':
      return 'bg-[color-mix(in_srgb,var(--sr-success)_70%,var(--sr-bg-surface))]'
    case 'low':
      return 'bg-[color-mix(in_srgb,var(--sr-warning)_60%,var(--sr-bg-surface))]'
    case 'minimal':
      return 'bg-[color-mix(in_srgb,var(--sr-warning)_30%,var(--sr-bg-surface))]'
    case 'none':
      return 'bg-[var(--sr-bg-surface)]'
  }
}

function statusTextColor(status: MuscleBalance['status']): string {
  switch (status) {
    case 'optimal':
      return 'text-[var(--sr-success)]'
    case 'low':
    case 'minimal':
      return 'text-[var(--sr-warning)]'
    case 'none':
      return 'text-[var(--sr-text-muted)]'
  }
}

function muscleGroupShortLabel(mg: MuscleGroup): string {
  switch (mg) {
    case 'chest':
      return pl.muscleGroup_chest
    case 'back':
      return pl.muscleGroup_back
    case 'shoulders':
      return pl.muscleGroup_shoulders
    case 'arms':
      return pl.muscleGroup_arms
    case 'legs':
      return pl.muscleGroup_legs
    case 'core':
      return pl.muscleGroup_core
    case 'full_body':
      return pl.muscleGroup_full_body
    case 'cardio':
      return pl.muscleGroup_cardio
    case 'other':
      return pl.muscleGroup_other
  }
}

export function MuscleBalanceHeatmap({
  sessions,
  weeks = 4,
}: {
  sessions: LocalWorkoutSession[]
  weeks?: number
}) {
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([])

  useEffect(() => {
    void db.exercises.toArray().then(setExercises).catch(() => setExercises([]))
  }, [])

  const balance = useMemo(
    () => computeMuscleBalance(sessions, exercises, weeks),
    [sessions, exercises, weeks],
  )

  const hasData = balance.some((b) => b.weeklySets > 0)
  const undertrainedGroups = balance.filter(
    (b) => b.weeklySets > 0 && (b.status === 'minimal' || b.status === 'none'),
  )
  const missingGroups = balance.filter((b) => b.weeklySets === 0)

  if (!hasData) {
    return (
      <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
        {pl.muscleBalanceNoData}
      </p>
    )
  }

  return (
    <div role="img" aria-label={pl.muscleBalanceAria}>
      {undertrainedGroups.length >= 1 && (
        <p className="mb-3 sr-text-body-sm text-[var(--sr-warning)]">
          {pl.muscleBalanceWarning}
        </p>
      )}

      {/* Trained groups — sorted by volume (from computeMuscleBalance) */}
      <ul className="space-y-2.5">
        {balance
          .filter((b) => b.weeklySets > 0)
          .map((b) => {
            const pct = Math.min(100, (b.weeklySets / OPTIMAL_SETS) * 100)
            return (
              <li key={b.muscleGroup}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                    {muscleGroupShortLabel(b.muscleGroup)}
                  </span>
                  <span className={cn('sr-text-body-sm font-semibold tabular-nums', statusTextColor(b.status))}>
                    {pl.muscleBalanceWeeklySets(b.weeklySets)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--sr-bg-surface)]">
                  <div
                    className={cn('h-full rounded-full transition-all', statusColor(b.status))}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            )
          })}
      </ul>

      {/* Untrained groups — compact summary */}
      {missingGroups.length > 0 && (
        <div className="mt-4 rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)] px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
            {pl.muscleBalanceNone}
          </p>
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-muted)]">
            {missingGroups.map((b) => muscleGroupShortLabel(b.muscleGroup)).join(' · ')}
          </p>
        </div>
      )}
    </div>
  )
}
