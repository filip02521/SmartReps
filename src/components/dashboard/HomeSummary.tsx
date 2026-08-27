import type { HomeLoadResult } from '@/lib/home-summary'
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
  const goalFrac = Math.min(summary.sessions14d, 3) / 3

  return (
    <section className="mb-5" aria-label={pl.navWorkout}>
      <p className="text-sm capitalize text-[var(--sr-text-muted)]">{summary.dateLabel}</p>
      <p className="mt-1 text-base font-semibold leading-snug text-[var(--sr-text-primary)]">
        {summary.statusSentence}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="tabular-nums text-xl font-bold text-[var(--sr-text-primary)]">
            {summary.sessions14d}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-[var(--sr-text-muted)]">
            {pl.homeSessions14d}
          </p>
          <p className="text-[10px] text-[var(--sr-text-muted)]">{pl.homeSessions14dHint}</p>
        </div>
        <div className="text-center">
          <p className="tabular-nums text-xl font-bold text-[var(--sr-text-primary)]">
            {summary.bestStreakWeeks}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-[var(--sr-text-muted)]">
            {pl.streakWeeks}
          </p>
        </div>
        <div className="text-center">
          <p className="tabular-nums text-xl font-bold text-[var(--sr-text-primary)]">
            {summary.reps14d}
          </p>
          <p className="mt-0.5 text-[11px] leading-tight text-[var(--sr-text-muted)]">
            {pl.homeReps14d}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs text-[var(--sr-text-muted)]">{pl.homeGoal3in14}</p>
          <p className="text-xs tabular-nums text-[var(--sr-text-muted)]">
            {Math.min(summary.sessions14d, 3)}/3
          </p>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full"
          style={{
            background: 'color-mix(in srgb, var(--sr-text-muted) 22%, transparent)',
          }}
          role="progressbar"
          aria-valuenow={Math.min(summary.sessions14d, 3)}
          aria-valuemin={0}
          aria-valuemax={3}
        >
          <div
            className="h-full rounded-full bg-[var(--sr-brand-primary)] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${goalFrac * 100}%` }}
          />
        </div>
      </div>

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
                  <span className="shrink-0 text-xs tabular-nums text-[var(--sr-text-muted)]">
                    {p.dayLabel}
                    {' · '}
                    {pl.attemptLabel(p.attempt)}
                    {p.paused ? ` · ${pl.statusPaused}` : ''}
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full"
                  style={{
                    background: 'color-mix(in srgb, var(--sr-text-muted) 22%, transparent)',
                  }}
                >
                  <div
                    className="h-full rounded-full bg-[var(--sr-success)] transition-[width] duration-300 motion-reduce:transition-none"
                    style={{
                      width: `${Math.round(p.fraction * 100)}%`,
                      background: p.testPending
                        ? 'var(--sr-brand-primary)'
                        : 'var(--sr-success)',
                    }}
                  />
                </div>
                <span className="text-[11px] text-[var(--sr-text-muted)]">
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
