import { ChevronDown } from 'lucide-react'
import type { HomeLoadResult, QuickCta } from '@/lib/home-summary'
import { getGreetingKey } from '@/lib/home-summary'
import { Button } from '@/components/ui/Button'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { UserPlanBadge } from '@/components/pro/UserPlanBadge'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { pl } from '@/i18n/pl'

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
  // Actionable kinds ('workout', 'workout-force', 'setup') are not rendered
  // here on purpose — the first program card directly below offers the exact
  // same action, and two stacked pulsing CTAs competed in the first viewport.
  // Only 'scroll' stays: jumping to a card is something no card button does.
  const showCta = cta?.kind === 'scroll' && !!onQuickCta
  return (
    <header className="mb-5">
      {/* Date + greeting — compact eyebrow; plan chip stays glued to the name
          and wraps as one unit on narrow screens (mobile 375px). */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
          {summary.dateLabel}
        </p>
        {displayName && (
          <>
            <span className="sr-text-body-sm text-[var(--sr-text-muted)]" aria-hidden>·</span>
            <span className="inline-flex min-w-0 items-center gap-2">
              <p className="min-w-0 truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
                {pl[greetingKey](displayName)}
              </p>
              <UserPlanBadge />
            </span>
          </>
        )}
        {!displayName && <UserPlanBadge />}
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
      {/* Scroll CTA — jump to the card that needs attention */}
      {showCta && cta && onQuickCta && (
        <Button
          size="touch"
          fullWidth
          className="mt-3"
          onClick={() => onQuickCta(cta)}
        >
          <span className="flex items-center justify-center gap-2">
            <ChevronDown size={18} aria-hidden />
            {cta.label}
          </span>
        </Button>
      )}
    </header>
  )
}

/** Activity metrics fragment — renders inside the merged "Twój tydzień"
 *  section on the dashboard, so it has no own header/landmark. */
export function HomeActivitySection({
  summary,
}: {
  summary: Summary
}) {
  return (
    <>
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
            value: summary.sessions14d > 0 ? Math.round(summary.reps14d / summary.sessions14d) : pl.noValue,
            label: pl.homeAvgPerSession,
            hint: pl.homeAvgPerSessionHint,
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
    </>
  )
}
