import { useNavigate } from 'react-router-dom'
import { ChevronRight, Activity } from 'lucide-react'
import type { HomeLoadResult } from '@/lib/home-summary'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { StreakHeatmap } from '@/components/progress/StreakHeatmap'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
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
  const navigate = useNavigate()
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
      {/* Streak heatmap — tappable, links to Progress for details */}
      {sessions.some((s) => s.status === 'completed') && (
        <button
          type="button"
          onClick={() => navigate('/progress')}
          aria-label={pl.streakHeatmapTitle}
          className={cn(
            FOCUS_RING,
            'group mt-3 flex w-full items-center gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]',
          )}
        >
          <div className="min-w-0 flex-1">
            <StreakHeatmap sessions={sessions} compact />
          </div>
          <ChevronRight
            size={16}
            aria-hidden
            className="shrink-0 text-[var(--sr-text-muted)] transition-colors group-hover:text-[var(--sr-text-primary)]"
          />
        </button>
      )}
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
