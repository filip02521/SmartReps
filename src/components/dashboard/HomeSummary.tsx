import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { WeeklyRecapPanel } from '@/components/dashboard/WeeklyRecap'
import { pl } from '@/i18n/pl'

type Summary = HomeLoadResult['summary']

export function HomeSummary({
  summary,
  weeklyRecap,
}: {
  summary: Summary
  weeklyRecap: HomeLoadResult['weeklyRecap']
}) {
  return (
    <section className="mb-5" aria-label={pl.navWorkout}>
      <p className="sr-text-body-sm capitalize text-[var(--sr-text-secondary)]">{summary.dateLabel}</p>
      <h2 className="mt-1 sr-text-h2 leading-snug text-[var(--sr-text-primary)]">
        {summary.statusHeadline}
      </h2>
      {summary.statusSubtitle && (
        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {summary.statusSubtitle}
        </p>
      )}

      <MetricStrip
        className="mt-4"
        metrics={[
          {
            value: summary.sessions14d,
            label: pl.homeSessions14d,
            hint: pl.homeSessions14dHint,
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

      <WeeklyRecapPanel recap={weeklyRecap} />
    </section>
  )
}
