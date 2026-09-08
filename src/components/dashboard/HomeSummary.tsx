import { Play, ChevronDown } from 'lucide-react'
import type { HomeLoadResult, QuickCta } from '@/lib/home-summary'
import { getGreetingKey } from '@/lib/home-summary'
import { Button } from '@/components/ui/Button'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { StreakChainCard } from '@/components/dashboard/StreakChainCard'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import type { LocalWorkoutSession } from '@/lib/db'

type Summary = HomeLoadResult['summary']

export function HomeStatusHeader({
  summary,
  displayName,
  onQuickCta,
}: {
  summary: Summary
  displayName?: string
  onQuickCta?: (cta: QuickCta) => void
}) {
  const greetingKey = getGreetingKey()
  const cta = summary.quickCta
  const showCta = cta && onQuickCta
  const isScroll = cta?.kind === 'scroll'
  return (
    <header className="mb-5">
      {/* Date + greeting — compact eyebrow */}
      <div className="flex items-baseline gap-2">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
          {summary.dateLabel}
        </p>
        {displayName && (
          <>
            <span className="sr-text-body-sm text-[var(--sr-text-muted)]" aria-hidden>·</span>
            <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
              {pl[greetingKey](displayName)}
            </p>
          </>
        )}
      </div>
      {/* Headline — dominant, immediate answer to "what should I do?" */}
      <h2 className="mt-1.5 sr-text-h2 leading-snug text-[var(--sr-text-primary)]">
        {summary.statusHeadline}
      </h2>
      {summary.statusSubtitle && (
        <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {summary.statusSubtitle}
        </p>
      )}
      {/* Quick CTA — primary action, one tap away */}
      {showCta && cta && onQuickCta && (
        <Button
          size="touch"
          fullWidth
          className={cn('mt-3', !isScroll && 'sr-pulse-cta')}
          onClick={() => onQuickCta(cta)}
        >
          <span className="flex items-center justify-center gap-2">
            {isScroll ? (
              <ChevronDown size={18} aria-hidden />
            ) : (
              <Play size={18} className="fill-current" aria-hidden />
            )}
            {cta.label}
          </span>
        </Button>
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
    <section aria-label={pl.homeActivityTitle}>
      <p className="mb-2 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
        {pl.homeActivityTitle}
      </p>
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
          {
            value: summary.streakWeeks,
            label: pl.homeStreakWeeksLabel,
            hint: pl.homeStreakWeeksHint,
          },
        ]}
        goal={{
          label: pl.homeGoalNin14(summary.goalTarget),
          current: summary.sessions14d,
          max: summary.goalTarget,
        }}
      />
      <ActivityInsightsPanel
        insights={summary.activity}
        compact
        customLastWorkout={summary.customLastWorkout}
      />
      {/* Streak chain — visual retention driver, tappable to Progress */}
      <StreakChainCard sessions={sessions} compact />
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
