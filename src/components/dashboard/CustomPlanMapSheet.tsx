import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { CustomPlanCycleRail } from '@/components/progress/CustomPlanCycleRail'
import { pl } from '@/i18n/pl'
import { db, type LocalWorkoutSession } from '@/lib/db'
import { getCustomPlan, listExercises } from '@/lib/custom-plan-service'
import { getCustomPlanDisplayDay } from '@/lib/custom-plan-home-summary'
import type {
  CustomPlan,
  CustomProgramProgress,
  ExerciseDefinition,
} from '@/lib/exercise-model'

/** Read-only plan map (cycle rail + per-day exercise list) as a self-loading
 *  sheet — given only a planId it fetches everything it needs. Shared by the
 *  home card menu and the compact training rows. */
export function CustomPlanMapSheet({
  planId,
  fallbackTitle,
  onClose,
}: {
  planId: string
  fallbackTitle: string
  onClose: () => void
}) {
  const [data, setData] = useState<{
    plan: CustomPlan
    progress: CustomProgramProgress | null
    exercises: Map<string, ExerciseDefinition>
    sessions: LocalWorkoutSession[]
  } | null>(null)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  // Keep the latest onClose in a ref — parents pass inline callbacks, and
  // depending on them directly would refetch the plan on every render.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const plan = await getCustomPlan(planId)
      if (!plan) {
        if (!cancelled) onCloseRef.current()
        return
      }
      // Read-only — don't create progress just by viewing the map.
      const progress =
        (await db.customProgramProgress.where('customPlanId').equals(planId).first()) ??
        null
      const sessions = await db.workoutSessions
        .where('customPlanId')
        .equals(planId)
        .toArray()
      const exList = await listExercises()
      if (cancelled) return
      setData({
        plan,
        progress,
        exercises: new Map(exList.map((e) => [e.id, e])),
        sessions,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [planId])

  const displayDay = data
    ? getCustomPlanDisplayDay(data.plan, data.progress)
    : 1
  const detailDay = selectedDay ?? displayDay
  const day = data?.plan.days.find((d) => d.dayNumber === detailDay)

  return (
    <Sheet
      open
      onClose={() => {
        setSelectedDay(null)
        onClose()
      }}
      title={data?.plan.name.trim() || fallbackTitle}
    >
      {!data ? (
        <div
          className="flex items-center justify-center py-8"
          aria-busy
          aria-label={pl.loading}
        >
          <Loader2
            size={20}
            className="animate-spin text-[var(--sr-text-muted)]"
            aria-hidden
          />
        </div>
      ) : (
        <div className="pb-2">
          <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.progressCustomPlanDayProgress(displayDay, data.plan.days.length)}
          </p>
          <CustomPlanCycleRail
            plan={data.plan}
            progress={data.progress}
            sessions={data.sessions}
            selectedDay={detailDay}
            onDayClick={setSelectedDay}
          />

          {day && (
            <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
              <p className="sr-text-overline text-[var(--sr-text-muted)]">
                {pl.dayLabel(detailDay)}
              </p>
              <ul className="mt-2 space-y-1.5">
                {day.exercises.map((ex, idx) => {
                  const def = data.exercises.get(ex.exerciseId)
                  const name = def?.name ?? pl.progressCustomExerciseFallback
                  return (
                    <li
                      key={`${ex.exerciseId}-${idx}`}
                      className="flex items-baseline justify-between gap-2"
                    >
                      <span className="min-w-0 break-words sr-text-body-sm text-[var(--sr-text-primary)]">
                        {name}
                      </span>
                      <span className="shrink-0 sr-text-caption text-[var(--sr-text-muted)]">
                        {pl.progressCustomDaySets(ex.sets.length)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
