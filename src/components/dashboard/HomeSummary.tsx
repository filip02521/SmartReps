import { Activity } from 'lucide-react'
import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { StreakChainCard } from '@/components/dashboard/StreakChainCard'
import { pl } from '@/i18n/pl'
import type { LocalWorkoutSession } from '@/lib/db'

type Summary = HomeLoadResult['summary']

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

export function HomeActivitySection({
  summary,
  sessions,
}: {
  summary: Summary
  sessions: LocalWorkoutSession[]
}) {
  return (
    <section className="mb-6" aria-label={pl.homeActivityTitle}>
      <SectionHeader icon={Activity} title={pl.homeActivityTitle} />
      <MetricStrip
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
      <ActivityInsightsPanel insights={summary.activity} />
      {/* Streak chain — visual retention driver, tappable to Progress */}
      <StreakChainCard sessions={sessions} />
      {summary.customLastWorkout && (
        <p className="mt-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.customLastWorkoutInsight(
            summary.customLastWorkout.planName,
            summary.customLastWorkout.whenLabel,
          )}
        </p>
      )}
    </section>
  )
}

/** @deprecated Prefer HomeStatusHeader + HomeActivitySection */
export function HomeSummary({
  summary,
  sessions,
}: {
  summary: Summary
  onScrollToProgram?: (program: import('@/data/plans/types').Program) => void
  sessions?: LocalWorkoutSession[]
}) {
  return (
    <section className="mb-5" aria-label={pl.navWorkout}>
      <HomeStatusHeader summary={summary} />
      <HomeActivitySection summary={summary} sessions={sessions ?? []} />
    </section>
  )
}
