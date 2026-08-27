import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'

type Summary = HomeLoadResult['summary']

export function HomeSummary({
  summary,
  onScrollToProgram,
}: {
  summary: Summary
  onScrollToProgram: (program: Program) => void
}) {
  return (
    <section className="mb-5" aria-label={pl.navWorkout}>
      <p className="sr-text-body-sm capitalize text-[var(--sr-text-muted)]">{summary.dateLabel}</p>
      <p className="mt-1 text-base font-semibold leading-snug text-[var(--sr-text-primary)]">
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

      {summary.programs.length > 0 && (
        <ul className="mt-4 space-y-2.5">
          {summary.programs.map((p) => (
            <li key={p.program}>
              <button
                type="button"
                className="flex w-full min-h-11 flex-col gap-1 rounded-[var(--sr-radius-md)] text-left"
                onClick={() => onScrollToProgram(p.program)}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-[var(--sr-text-primary)]">
                    {p.label}
                  </span>
                  <span className="shrink-0 sr-text-caption tabular-nums text-[var(--sr-text-muted)]">
                    {p.dayLabel}
                    {' · '}
                    {pl.attemptLabel(p.attempt)}
                    {p.paused ? ` · ${pl.statusPaused}` : ''}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--sr-text-muted)_22%,transparent)]">
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
                <span className="sr-text-caption text-[var(--sr-text-muted)]">
                  {p.cycleNameShort}
                  {' · '}
                  {p.completedDays}/{p.totalDays}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
