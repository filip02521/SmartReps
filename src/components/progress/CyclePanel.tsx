import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { CycleDayPicker } from '@/components/ui/CycleDayPicker'
import { Button } from '@/components/ui/Button'
import { LogoMark } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ux/Feedback'
import { NestedStat } from '@/components/ui/NestedStat'
import { pl } from '@/i18n/pl'
import type { Cycle } from '@/data/plans/types'
import type { Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import type { ProgramStats, ProgramRecordsWithDates } from '@/lib/stats-engine'
import { hasAnyProgramRecords } from '@/lib/progress-history'
import { navigateToTrain } from '@/lib/setup-flow'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import type { NavigateFunction } from 'react-router-dom'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'

export function CyclePanel({
  program,
  cycle,
  progress,
  stats,
  maxPerDay,
  records,
  recordsWithDates,
  cyclePreviewDay,
  onSelectDay,
  navigate,
}: {
  program: Program
  cycle: Cycle | undefined
  progress: LocalProgramProgress | undefined
  stats: ProgramStats | null
  maxPerDay: { day: number; maxActual: number }[]
  records: {
    bestTest: number | null
    bestMaxSet: number | null
    bestSessionTotal: number | null
    highestCycleName: string | null
  } | null
  recordsWithDates: ProgramRecordsWithDates | null
  cyclePreviewDay: number | null
  onSelectDay: (day: number) => void
  navigate: NavigateFunction
}) {
  if (!cycle || !progress) {
    return (
      <ProgressSection first>
        <EmptyState
          icon={<LogoMark size={48} />}
          title={pl.cycleNotConfigured}
          action={{ label: pl.configureProgram, onClick: () => navigate(`/setup/test/${program}`) }}
        />
      </ProgressSection>
    )
  }

  return (
    <>
      <ProgressSection
        first
        title={pl.cycleMapTitle(cycle.nameShort)}
        hint={pl.progressCycleProgress(
          stats?.completedDaysInCycle ?? 0,
          stats?.cycleDaysTotal ?? cycle.days.length,
        )}
      >
        <CycleDayPicker
          totalDays={cycle.days.length}
          selectedDay={cyclePreviewDay}
          onSelect={onSelectDay}
          days={cycle.days.map((d) => ({
            dayNumber: d.dayNumber,
            status: getCycleDayStatus(progress, d.dayNumber, cycle.days.length),
          }))}
        />
        <p className="mt-3 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.cycleMapHint}</p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          fullWidth
          onClick={() => navigate(`/plans?tab=programs&highlight=${progress.cycleId}`)}
        >
          {pl.progressFullCyclePlan}
        </Button>
      </ProgressSection>

      {maxPerDay.length > 0 && (
        <ProgressSection title={pl.maxSetPerDay} hint={pl.progressMaxSetChartHint}>
          <div className="h-36 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] py-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={maxPerDay}>
                <XAxis
                  dataKey="day"
                  tickFormatter={(d) => pl.chartDayShort(Number(d))}
                  tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  width={28}
                />
                <Tooltip
                  contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                  formatter={(value) => [value ?? 0, pl.repsUnit]}
                  labelFormatter={(label) => String(label)}
                />
                <Bar dataKey="maxActual" fill="var(--sr-brand-primary)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ProgressSection>
      )}

      {recordsWithDates && (
        <ProgressSection title={pl.progressRecordsSectionTitle}>
          <div id="progress-records">
            {records && hasAnyProgramRecords(records) ? (
              <div className="grid grid-cols-2 gap-2">
                <NestedStat
                  size="md"
                  overline={pl.recordBestMaxSet}
                  value={recordsWithDates.bestMaxSet ?? pl.noValue}
                  hint={
                    recordsWithDates.bestMaxSetDate
                      ? pl.progressRecordDate(
                          format(new Date(recordsWithDates.bestMaxSetDate), 'd MMM yyyy', {
                            locale: plLocale,
                          }),
                        )
                      : undefined
                  }
                />
                <NestedStat
                  size="md"
                  overline={pl.recordBestSession}
                  value={recordsWithDates.bestSessionTotal ?? pl.noValue}
                  hint={
                    recordsWithDates.bestSessionTotalDate
                      ? pl.progressRecordDate(
                          format(
                            new Date(recordsWithDates.bestSessionTotalDate),
                            'd MMM yyyy',
                            { locale: plLocale },
                          ),
                        )
                      : undefined
                  }
                />
                <NestedStat
                  size="md"
                  overline={pl.totalRepsLabel}
                  value={stats?.totalRepsAllTime ?? pl.noValue}
                />
                <NestedStat
                  size="md"
                  overline={pl.recordHighestCycle}
                  value={recordsWithDates.highestCycleName ?? pl.noValue}
                />
              </div>
            ) : (
              <EmptyState
                icon={<LogoMark size={40} />}
                title={pl.progressRecordsEmpty}
                action={{
                  label: pl.startFirstWorkout,
                  onClick: () => void navigateToTrain(navigate, program),
                }}
              />
            )}
          </div>
        </ProgressSection>
      )}
    </>
  )
}
