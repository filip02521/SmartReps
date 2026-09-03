import type { ReactNode } from 'react'
import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

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

export function HomeStatusHeader({ summary }: { summary: Summary }) {
  return (
    <header className="mb-5">
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
  )
}

export function HomeActivitySection({ summary }: { summary: Summary }) {
  return (
    <section aria-label={pl.homeActivityTitle}>
      <HomeSection title={pl.homeActivityTitle}>
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
        {summary.customLastWorkout && (
          <p className="mt-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.customLastWorkoutInsight(
              summary.customLastWorkout.planName,
              summary.customLastWorkout.whenLabel,
            )}
          </p>
        )}
      </HomeSection>
    </section>
  )
}

/** @deprecated Prefer HomeStatusHeader + HomeActivitySection */
export function HomeSummary({
  summary,
}: {
  summary: Summary
  onScrollToProgram?: (program: import('@/data/plans/types').Program) => void
}) {
  return (
    <section className="mb-5" aria-label={pl.navWorkout}>
      <HomeStatusHeader summary={summary} />
      <HomeActivitySection summary={summary} />
    </section>
  )
}
