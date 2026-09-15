import { lazy, Suspense } from 'react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { CycleDayPicker } from '@/components/ui/CycleDayPicker'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import { pl } from '@/i18n/pl'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import type { Cycle } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import type { ProgramStats } from '@/lib/stats-engine'

const MaxPerDayChart = lazy(() =>
  import('../MaxPerDayChart').then((m) => ({ default: m.MaxPerDayChart })),
)

/** Stale in-progress session while resting — abandon only, or abandon+train. */
export function StaleRestSheet({
  busy,
  onAbandon,
  onAbandonAndTrain,
  onClose,
}: {
  busy: boolean
  onAbandon: () => void
  onAbandonAndTrain: () => void
  onClose: () => void
}) {
  return (
    <Sheet open onClose={onClose} title={pl.abandonOrTrainAnywayTitle}>
      <p className="mb-4 text-sm text-[var(--sr-text-secondary)]">
        {pl.abandonOrTrainAnywayBody} {pl.forceRestRestartHint}
      </p>
      <div className="flex flex-col gap-2 pb-2">
        <Button variant="secondary" fullWidth disabled={busy} onClick={onAbandon}>
          {pl.abandonOnly}
        </Button>
        <Button variant="ghost" fullWidth disabled={busy} onClick={onAbandonAndTrain}>
          {pl.abandonAndTrain}
        </Button>
      </div>
    </Sheet>
  )
}

/** Cycle map — day picker with per-day targets, max-set-per-day chart,
 *  and a link to the full plan on the Programs tab. */
export function CycleMapSheet({
  cycle,
  progress,
  stats,
  maxPerDay,
  selectedDay,
  onSelectDay,
  onShowFullPlan,
  onClose,
}: {
  cycle: Cycle
  progress: LocalProgramProgress
  stats: ProgramStats | null
  maxPerDay: { day: number; maxActual: number }[]
  selectedDay: number | null
  onSelectDay: (day: number | null) => void
  onShowFullPlan: () => void
  onClose: () => void
}) {
  const day = selectedDay !== null
    ? cycle.days.find((d) => d.dayNumber === selectedDay) ?? null
    : null

  return (
    <Sheet open onClose={onClose} title={pl.cycleMapTitle(cycle.nameShort)}>
      <div className="pb-2">
        <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.progressCycleProgress(
            stats?.completedDaysInCycle ?? 0,
            stats?.cycleDaysTotal ?? cycle.days.length,
          )}
        </p>
        <CycleDayPicker
          totalDays={cycle.days.length}
          selectedDay={selectedDay}
          onSelect={onSelectDay}
          days={cycle.days.map((d) => ({
            dayNumber: d.dayNumber,
            status: getCycleDayStatus(progress, d.dayNumber, cycle.days.length),
          }))}
        />

        {day && (
          <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
            <p className="sr-text-overline text-[var(--sr-text-muted)]">
              {pl.dayLabel(day.dayNumber)}
            </p>
            <div className="mt-2">
              <SetTargetsRow sets={day.sets} size="md" />
              <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.restBetweenSets(day.restBetweenSetsSec)}
              </p>
            </div>
          </div>
        )}

        {maxPerDay.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
              {pl.maxSetPerDay}
            </p>
            <AccessibleChart
              label={pl.progressMaxSetChartAria(maxPerDay.length)}
              data={maxPerDay.map((d) => ({ day: pl.dayLabel(d.day), max: d.maxActual }))}
              columns={[
                { key: 'day', header: pl.dayLabelShort },
                { key: 'max', header: pl.repsUnit },
              ]}
              className="h-36 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1"
            >
              <Suspense fallback={null}>
                <MaxPerDayChart data={maxPerDay} />
              </Suspense>
            </AccessibleChart>
          </div>
        )}

        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          fullWidth
          onClick={onShowFullPlan}
        >
          {pl.progressFullCyclePlan}
        </Button>
      </div>
    </Sheet>
  )
}
