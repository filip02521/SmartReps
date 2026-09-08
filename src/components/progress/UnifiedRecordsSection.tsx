import { ChevronRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { format } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { NestedStat } from '@/components/ui/NestedStat'
import { LogoMark } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ux/Feedback'
import { ExerciseSparkline } from '@/components/plans/ExerciseSparkline'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import { formatDurationDisplay } from '@/lib/custom-prescription-format'
import type { ExercisePr } from '@/lib/custom-stats'
import type { ExerciseTrend } from '@/lib/custom-exercise-stats'
import type { ProgramRecordsWithDates, ProgramStats } from '@/lib/stats-engine'
import { hasAnyProgramRecords } from '@/lib/progress-history'
import type { Program } from '@/data/plans/types'

type ProgramRecordEntry = {
  program: Program
  records: ProgramRecordsWithDates
  stats: ProgramStats
}

function trendDotClass(trend: ExerciseTrend): string | null {
  if (trend === 'up') return 'bg-[var(--sr-success)]'
  if (trend === 'down') return 'bg-[var(--sr-error)]'
  if (trend === 'flat') return 'bg-[var(--sr-text-muted)]'
  return null
}

function formatExercisePrLine(pr: ExercisePr, weightUnit: 'kg' | 'lb' = 'kg'): string {
  return (
    [
      pr.maxReps != null ? `${pr.maxReps} ${pl.repsUnit}` : null,
      pr.maxDurationSec != null
        ? formatDurationDisplay(pr.maxDurationSec, pr.durationDisplayUnit ?? 'min')
        : null,
      pr.maxWeightKg != null ? `${kgToDisplay(pr.maxWeightKg, weightUnit)} ${weightUnitLabel(weightUnit)}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || pl.noValue
  )
}

export function UnifiedRecordsSection({
  programRecordsList,
  customPrs,
  onOpenExercise,
  first,
  icon,
}: {
  programRecordsList: ProgramRecordEntry[]
  customPrs: ExercisePr[]
  onOpenExercise: (exerciseId: string) => void
  first?: boolean
  icon?: LucideIcon
}) {
  const weightUnit = useAppStore((s) => s.settings.weightUnit)
  const validProgramEntries = programRecordsList.filter((e) =>
    hasAnyProgramRecords({
      bestTest: e.stats.maxTestRecord ?? null,
      bestMaxSet: e.records.bestMaxSet ?? null,
      bestSessionTotal: e.records.bestSessionTotal ?? null,
      highestCycleName: e.records.highestCycleName ?? null,
    }),
  )
  const hasProgramRecords = validProgramEntries.length > 0
  const hasCustomRecords = customPrs.length > 0

  if (!hasProgramRecords && !hasCustomRecords) {
    return (
      <ProgressSection first={first} icon={icon} title={pl.progressRecordsSectionTitle}>
        <EmptyState
          icon={<LogoMark size={40} />}
          title={pl.progressRecordsEmpty}
        />
      </ProgressSection>
    )
  }

  return (
    <ProgressSection first={first} icon={icon} title={pl.progressRecordsSectionTitle}>
      <div id="progress-records">
        {/* Programy wbudowane — po jednej sekcji per program */}
        {validProgramEntries.map((entry) => {
          const { program, records, stats } = entry
          const label = program === 'pushups' ? pl.pushupsProgram : program === 'pullups' ? pl.pullupsProgram : program
          return (
            <div key={program} className="mb-4">
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <NestedStat
                  size="md"
                  overline={pl.recordBestMaxSet}
                  value={records.bestMaxSet ?? pl.noValue}
                  hint={
                    records.bestMaxSetDate
                      ? pl.progressRecordDate(
                          format(new Date(records.bestMaxSetDate), 'd MMM yyyy', {
                            locale: dateFnsLocale(),
                          }),
                        )
                      : undefined
                  }
                />
                <NestedStat
                  size="md"
                  overline={pl.recordBestSession}
                  value={records.bestSessionTotal ?? pl.noValue}
                  hint={
                    records.bestSessionTotalDate
                      ? pl.progressRecordDate(
                          format(
                            new Date(records.bestSessionTotalDate),
                            'd MMM yyyy',
                            { locale: dateFnsLocale() },
                          ),
                        )
                      : undefined
                  }
                />
                <NestedStat
                  size="md"
                  overline={pl.totalRepsLabel}
                  value={stats.totalRepsAllTime ?? pl.noValue}
                />
                <NestedStat
                  size="md"
                  overline={pl.recordHighestCycle}
                  value={records.highestCycleName ?? pl.noValue}
                />
              </div>
            </div>
          )
        })}

        {/* Własne ćwiczenia */}
        {hasCustomRecords && (
          <div>
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
              {pl.progressRecordsExercises}
            </p>
            <ul className="flex flex-col gap-2.5">
              {customPrs.map((pr) => (
                <li key={pr.exerciseId}>
                  <button
                    type="button"
                    className={cn(
                      FOCUS_RING,
                      'flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)]',
                      'bg-[var(--sr-bg-surface)] px-3.5 py-3.5 text-left transition-colors',
                      'hover:border-[var(--sr-border-strong)]',
                    )}
                    onClick={() => onOpenExercise(pr.exerciseId)}
                  >
                    <ExerciseSparkline values={pr.sparkline} active={pr.sessionCount > 0} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-[var(--sr-text-primary)]">
                          {pr.name}
                        </p>
                        {trendDotClass(pr.trend) && (
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              trendDotClass(pr.trend),
                            )}
                            aria-hidden
                          />
                        )}
                      </div>
                      <p className="mt-1 text-sm font-medium tabular-nums text-[var(--sr-text-primary)]">
                        {formatExercisePrLine(pr, weightUnit)}
                      </p>
                      <p className="mt-0.5 sr-text-caption text-[var(--sr-text-muted)]">
                        {[
                          pr.sessionCount > 0
                            ? pl.progressCustomSessionCount(pr.sessionCount)
                            : null,
                          pr.lastSessionAt
                            ? `${pl.exerciseDetailLastTrained} ${format(new Date(pr.lastSessionAt), 'd MMM', { locale: dateFnsLocale() })}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <ChevronRight
                      size={20}
                      className="shrink-0 text-[var(--sr-text-muted)]"
                      aria-hidden
                    />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ProgressSection>
  )
}
