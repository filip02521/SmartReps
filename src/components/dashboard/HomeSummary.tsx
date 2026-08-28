import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { Badge } from '@/components/ui/Card'
import { WeeklyRecapPanel } from '@/components/dashboard/WeeklyRecap'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'

type Summary = HomeLoadResult['summary']

export function HomeSummary({
  summary,
  weeklyRecap,
  onScrollToProgram,
}: {
  summary: Summary
  weeklyRecap: HomeLoadResult['weeklyRecap']
  onScrollToProgram: (program: Program) => void
}) {
  return (
    <section className="mb-5" aria-label={pl.navWorkout}>
      <p className="sr-text-body-sm capitalize text-[var(--sr-text-secondary)]">{summary.dateLabel}</p>
      <p className="mt-1 sr-text-h3 leading-snug text-[var(--sr-text-primary)]">
        {summary.statusSentence}
      </p>

      <MetricStrip
        className="mt-4"
        metrics={[
          {
            value: summary.sessions14d,
            label: pl.homeSessions14d,
            hint: pl.homeSessions14dHint,
          },
          { value: summary.bestStreakWeeks, label: pl.streakWeeks },
          { value: summary.reps14d, label: pl.homeReps14d },
        ]}
        goal={{
          label: pl.homeGoal3in14,
          current: summary.sessions14d,
          max: 3,
        }}
      />

      <WeeklyRecapPanel recap={weeklyRecap} />

      {summary.programs.length > 0 && (
        <ul className="mt-4 space-y-3">
          {summary.programs.map((p) => (
            <li key={p.program}>
              <button
                type="button"
                className="flex w-full min-h-11 flex-col gap-1.5 rounded-[var(--sr-radius-md)] text-left"
                onClick={() => onScrollToProgram(p.program)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--sr-text-primary)]">{p.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {p.paused && <Badge variant="warning">{pl.statusPaused}</Badge>}
                    <span className="sr-text-body-sm tabular-nums text-[var(--sr-text-secondary)]">
                      {p.dayLabel}
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--sr-bg-surface)]">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${Math.round(p.fraction * 100)}%`,
                      background: p.testPending
                        ? 'var(--sr-brand-primary)'
                        : 'var(--sr-success)',
                    }}
                  />
                </div>
                <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                  {p.cycleNameShort}
                  {' · '}
                  <span className="tabular-nums text-[var(--sr-text-primary)]">
                    {p.completedDays}/{p.totalDays}
                  </span>
                  {!p.paused && (
                    <>
                      {' · '}
                      {pl.attemptLabel(p.attempt)}
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
