import type { ReactNode } from 'react'
import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { Badge } from '@/components/ui/Card'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import type { Program } from '@/data/plans/types'

type Summary = HomeLoadResult['summary']

function HomeSection({
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
        'border-t border-[var(--sr-border-subtle)] pt-5 first:border-t-0 first:pt-0',
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
  onScrollToProgram,
}: {
  summary: Summary
  onScrollToProgram: (program: Program) => void
}) {
  return (
    <section className="mb-5" aria-label={pl.navWorkout}>
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

      <div className="mt-5 space-y-5">
        <HomeSection title={pl.homeActivityTitle} hint={pl.homeActivityHint}>
          <MetricStrip
            metrics={[
              {
                value: summary.sessions14d,
                label: pl.homeSessions14d,
                hint: pl.homeSessions14dHint,
              },
              {
                value: summary.streakWeeks,
                label: pl.streakWeeks,
                hint: pl.homeStreakWeeksHint,
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
          <ActivityInsightsPanel insights={summary.activity} />
        </HomeSection>

        {summary.programs.length > 0 && (
          <HomeSection title={pl.homeProgramsQuickTitle} hint={pl.homeProgramsQuickHint}>
            <ul className="divide-y divide-[var(--sr-border-subtle)]">
              {summary.programs.map((p) => (
                <li key={p.program}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full min-h-11 flex-col gap-2 py-3 text-left',
                      'rounded-[var(--sr-radius-md)] transition-colors',
                      'hover:bg-[var(--sr-bg-surface)] active:bg-[var(--sr-bg-surface)]',
                    )}
                    onClick={() => onScrollToProgram(p.program)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--sr-text-primary)]">
                        {p.label}
                      </span>
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
          </HomeSection>
        )}
      </div>
    </section>
  )
}
