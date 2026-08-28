import type { ReactNode } from 'react'
import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { Badge } from '@/components/ui/Card'
import { WeeklyRecapPanel } from '@/components/dashboard/WeeklyRecap'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import type { Program } from '@/data/plans/types'

type Summary = HomeLoadResult['summary']

function HomePanel({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3',
        className,
      )}
    >
      <p className="sr-text-overline text-[var(--sr-text-muted)]">{title}</p>
      {hint && (
        <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">{hint}</p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  )
}

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
    <section className="mb-5 space-y-4" aria-label={pl.navWorkout}>
      <header>
        <p className="sr-text-body-sm capitalize text-[var(--sr-text-secondary)]">
          {summary.dateLabel}
        </p>
        <h2 className="mt-1 sr-text-h2 leading-snug text-[var(--sr-text-primary)]">
          {summary.statusHeadline}
        </h2>
        {summary.statusSubtitle && (
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {summary.statusSubtitle}
          </p>
        )}
      </header>

      <HomePanel title={pl.homeStats14dTitle} hint={pl.homeStats14dHint}>
        <MetricStrip
          metrics={[
            {
              value: summary.sessions14d,
              label: pl.homeSessions14d,
              hint: pl.homeSessions14dHint,
            },
            {
              value: summary.bestStreakWeeks,
              label: pl.streakWeeks,
              hint: pl.streakWeeksHint,
            },
            {
              value: summary.reps14d,
              label: pl.homeReps14d,
              hint: pl.homeReps14dHint,
            },
          ]}
          goal={{
            label: pl.homeGoal3in14,
            current: summary.sessions14d,
            max: 3,
          }}
        />
      </HomePanel>

      <WeeklyRecapPanel recap={weeklyRecap} />

      {summary.programs.length > 0 && (
        <HomePanel title={pl.homeProgramsQuickTitle} hint={pl.homeProgramsQuickHint}>
          <ul className="space-y-3">
            {summary.programs.map((p) => (
              <li key={p.program}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full min-h-11 flex-col gap-2 rounded-[var(--sr-radius-md)] text-left',
                    'transition-colors hover:bg-[var(--sr-bg-surface)]',
                  )}
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
                    {p.testPending
                      ? pl.cycleDoneTestLabel
                      : pl.homeProgramLevelDay(p.cycleNameShort, p.currentDay, p.totalDays)}
                    {p.attempt >= 2 && (
                      <>
                        {' · '}
                        {pl.homeCycleRestart(p.attempt)}
                      </>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </HomePanel>
      )}
    </section>
  )
}
