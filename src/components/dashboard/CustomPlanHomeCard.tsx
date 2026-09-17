import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { getOrCreateCustomProgress, getCustomPlan, setCustomPlanPaused, listExercises } from '@/lib/custom-plan-service'
import { getCustomPlanDisplayDay } from '@/lib/custom-plan-home-summary'
import { CustomWorkoutPreviewSheet } from '@/components/workout/WorkoutPreviewSheet'
import { CustomPlanCycleRail } from '@/components/progress/CustomPlanCycleRail'
import type { CustomPlan, ExerciseDefinition, PlanDay } from '@/lib/exercise-model'
import type { CustomPlanHomeCardModel, CustomPlanCycleDay } from '@/lib/custom-plan-home-summary'
import type { CustomCycleDayStatus } from '@/lib/custom-plan-cycle-rail'
import { cn } from '@/lib/utils'
import { AccentCard } from '@/components/ui/ProgramAccentCard'
import { AccentIconBadge } from '@/components/dashboard/program-card/ProgramIconBadge'
import { pl } from '@/i18n/pl'
import { HomeCardHeader } from '@/components/dashboard/program-card/HomeCardHeader'
import { Dumbbell, Play } from 'lucide-react'

// Mini cycle rail — non-interactive dots/bars showing day status.
// Mirrors the builtin CycleDayRail visual language but with custom plan statuses.
function MiniCustomCycleRail({ days, totalDays }: { days: CustomPlanCycleDay[]; totalDays: number }) {
  const tone: Record<CustomCycleDayStatus, string> = {
    passed: 'bg-[var(--sr-success)]',
    failed: 'bg-[var(--sr-error)]',
    current: 'bg-[var(--sr-brand-primary)]',
    upcoming: 'bg-[var(--sr-bg-surface)]',
    rest: 'bg-[var(--sr-border-subtle)]',
  }
  const ariaLabel: Record<CustomCycleDayStatus, string> = {
    passed: pl.customCycleDayPassed,
    failed: pl.customCycleDayFailed,
    current: pl.customCycleDayCurrent,
    upcoming: pl.customCycleDayUpcoming,
    rest: pl.customCycleDayRest,
  }
  return (
    <div
      className="flex items-end gap-0.5"
      role="list"
      aria-label={pl.progressCustomPlanMapTitle}
    >
      {days.map((d) => {
        const isCurrent = d.status === 'current'
        return (
          <div
            key={d.dayNumber}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            aria-label={`${pl.dayOfTotal(d.dayNumber, totalDays)} — ${ariaLabel[d.status]}`}
            className={cn(
              'flex h-5 flex-1 items-center justify-center rounded-[var(--sr-radius-sm)] text-[9px] font-semibold tabular-nums leading-none transition-colors',
              tone[d.status],
              isCurrent && 'ring-2 ring-[var(--sr-brand-primary)]/30',
              d.status === 'passed' && 'text-[var(--sr-text-inverse)]',
              d.status === 'failed' && 'text-[var(--sr-text-inverse)]',
              d.status === 'current' && 'text-[var(--sr-text-inverse)]',
              (d.status === 'upcoming' || d.status === 'rest') && 'text-[var(--sr-text-muted)]',
            )}
          >
            {d.dayNumber}
          </div>
        )
      })}
    </div>
  )
}

export function CustomPlanHomeCard({
  model,
  onUpdated,
}: {
  model: CustomPlanHomeCardModel
  onUpdated?: () => void
}) {
  const navigate = useNavigate()
  const [showMenu, setShowMenu] = useState(false)
  const [preview, setPreview] = useState<{
    plan: CustomPlan
    day: PlanDay
    dayNumber: number
    exercises: Map<string, ExerciseDefinition>
  } | null>(null)
  const [planMap, setPlanMap] = useState<{
    plan: CustomPlan
    progress: import('@/lib/exercise-model').CustomProgramProgress | null
    exercises: Map<string, ExerciseDefinition>
    sessions: import('@/lib/db').LocalWorkoutSession[]
  } | null>(null)
  const [planMapDay, setPlanMapDay] = useState<number | null>(null)

  async function openPreview() {
    const plan = await getCustomPlan(model.planId)
    if (!plan) return
    const progress = await getOrCreateCustomProgress(model.planId)
    const dayNumber = getCustomPlanDisplayDay(plan, progress ?? null)
    const day = plan.days.find((d) => d.dayNumber === dayNumber) ?? plan.days[0]
    if (!day) return
    const exList = await listExercises()
    const exMap = new Map(exList.map((e) => [e.id, e]))
    setPreview({ plan, day, dayNumber, exercises: exMap })
  }

  function handleStart() {
    setPreview(null)
    navigate(`/workout/custom/${model.planId}`)
  }

  async function openPlanMap() {
    const plan = await getCustomPlan(model.planId)
    if (!plan) return
    // Read-only — don't create progress just by viewing the map.
    const { db } = await import('@/lib/db')
    const progress = await db.customProgramProgress
      .where('customPlanId')
      .equals(model.planId)
      .first()
    const planSessions = await db.workoutSessions
      .where('customPlanId')
      .equals(model.planId)
      .toArray()
    const exList = await listExercises()
    const exMap = new Map(exList.map((e) => [e.id, e]))
    setPlanMap({ plan, progress: progress ?? null, exercises: exMap, sessions: planSessions })
  }

  return (
    <AccentCard accent="var(--sr-brand-primary)">
      {/* Header — shared HomeCardHeader row keeps builtin and custom
          program cards visually identical. */}
      <HomeCardHeader
        icon={
          <AccentIconBadge accent="var(--sr-brand-primary)">
            <Dumbbell size={20} strokeWidth={2.25} />
          </AccentIconBadge>
        }
        title={model.planName}
        badge={model.badge}
        menuLabel={pl.menuCustomPlan}
        menuExpanded={showMenu}
        onMenu={() => setShowMenu(true)}
      />

      <Sheet open={showMenu} onClose={() => setShowMenu(false)} title={pl.menuCustomPlan}>
        <div className="flex flex-col gap-1 pb-2">
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              void openPlanMap()
            }}
          >
            {pl.menuPlanMap}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            className="justify-start px-3"
            onClick={() => {
              setShowMenu(false)
              navigate('/progress?tab=history')
            }}
          >
            {pl.menuHistory}
          </Button>
          {!model.isPaused && !model.isCycleComplete && (
            <Button
              variant="ghost"
              fullWidth
              className="justify-start px-3"
              onClick={() => {
                setShowMenu(false)
                void setCustomPlanPaused(model.planId, true).then(() => onUpdated?.())
              }}
            >
              {pl.planPause}
            </Button>
          )}
          {model.isPaused && (
            <Button
              variant="ghost"
              fullWidth
              className="justify-start px-3"
              onClick={() => {
                setShowMenu(false)
                void setCustomPlanPaused(model.planId, false).then(() => onUpdated?.())
              }}
            >
              {pl.planResume}
            </Button>
          )}
        </div>
      </Sheet>

      {/* Metrics row + mini cycle rail — same pattern as the builtin card
          (caption metrics + pct right, rail shows progress, no extra bar). */}
      {model.totalDays > 0 && (
        <div className="mt-2.5">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="sr-text-caption text-[var(--sr-text-secondary)]">
              {model.isCycleComplete
                ? pl.homeCustomStatusCycleComplete
                : pl.homeCustomDayOf(
                    Math.max(1, Math.min(model.completedDays + (model.isResting ? 0 : 1), model.totalDays)),
                    model.totalDays,
                  )}
              {(model.cycleAttempt ?? 1) >= 2 && (
                <>
                  {' · '}
                  {pl.attemptShort(model.cycleAttempt)}
                </>
              )}
            </p>
            <p className="shrink-0 sr-text-caption font-semibold tabular-nums text-[var(--sr-text-primary)]">
              {model.pct}%
            </p>
          </div>
          {model.cycleDays && (
            <MiniCustomCycleRail days={model.cycleDays} totalDays={model.totalDays} />
          )}
        </div>
      )}

      {/* Detail line — compact status info (resume hint, rest days, etc.) */}
      {model.detailLine && (
        <p className="mt-2 line-clamp-1 sr-text-caption text-[var(--sr-text-secondary)]">
          {model.detailLine}
        </p>
      )}

      {/* CTA — same touch size + divider spacing as the builtin card. */}
      <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3">
        <Button
          type="button"
          size="touch"
          fullWidth
          className={cn(model.resume && 'sr-pulse-cta')}
          onClick={() => {
            if (model.ctaAction === 'unpause') {
              void setCustomPlanPaused(model.planId, false).then(() => onUpdated?.())
              return
            }
            // Resume → go directly (workout already in progress).
            if (model.resume) {
              navigate(`/workout/custom/${model.planId}`)
              return
            }
            // Fresh start → preview first.
            void openPreview()
          }}
        >
          <span className="flex items-center justify-center gap-2">
            {model.resume && <Play size={18} className="fill-current" />}
            {model.ctaLabel}
          </span>
        </Button>
      </div>

      {preview && (
        <CustomWorkoutPreviewSheet
          open
          onClose={() => setPreview(null)}
          planId={model.planId}
          planName={preview.plan.name.trim() || model.planName}
          dayNumber={preview.dayNumber}
          originalDay={preview.day}
          exercises={preview.exercises}
          plan={preview.plan}
          onStart={handleStart}
        />
      )}

      {planMap && (
        <Sheet
          open
          onClose={() => {
            setPlanMap(null)
            setPlanMapDay(null)
          }}
          title={planMap.plan.name.trim() || model.planName}
        >
          <div className="pb-2">
            <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.progressCustomPlanDayProgress(
                getCustomPlanDisplayDay(planMap.plan, planMap.progress),
                planMap.plan.days.length,
              )}
            </p>
            <CustomPlanCycleRail
              plan={planMap.plan}
              progress={planMap.progress}
              sessions={planMap.sessions}
              selectedDay={planMapDay ?? getCustomPlanDisplayDay(planMap.plan, planMap.progress)}
              onDayClick={setPlanMapDay}
            />

            {(() => {
              const detailDay = planMapDay ?? getCustomPlanDisplayDay(planMap.plan, planMap.progress)
              const day = planMap.plan.days.find((d) => d.dayNumber === detailDay)
              if (!day) return null
              return (
                <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
                  <p className="sr-text-overline text-[var(--sr-text-muted)]">
                    {pl.dayLabel(detailDay)}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {day.exercises.map((ex, idx) => {
                      const def = planMap.exercises.get(ex.exerciseId)
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
              )
            })()}
          </div>
        </Sheet>
      )}
    </AccentCard>
  )
}
