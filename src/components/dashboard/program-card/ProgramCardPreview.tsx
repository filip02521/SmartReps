import { pl } from '@/i18n/pl'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { FeedbackBanner } from '@/components/ux/Feedback'
import type { SetTarget } from '@/data/plans/types'
import type { ProgramStats } from '@/lib/stats-engine'
import type { ProgramBucket, ResumeInfo, TipSuppression } from '@/lib/home-summary'

/** Session preview — one slot, five mutually exclusive variants:
 *  resume progress / paused / rest gate / today's sets / nothing. */
export function ProgramCardPreview({
  bucket,
  hasResume,
  resume,
  stats,
  daysLeft,
  hideRestPreview,
  currentDaySets,
  setsTargetTotal,
}: {
  bucket: ProgramBucket
  hasResume: boolean
  resume: ResumeInfo | null
  stats: ProgramStats | null
  daysLeft: number
  hideRestPreview: boolean
  currentDaySets: SetTarget[] | null
  setsTargetTotal: number | null
}) {
  if (hasResume && resume) {
    return (
      <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,var(--sr-bg-surface))] px-3.5 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">{pl.statusInProgress}</p>
          <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
            {pl.homeInProgressSets(resume.set, resume.total, resume.day)}
          </p>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {Array.from({ length: resume.total }, (_, i) => (
            <span
              key={i}
              className="h-2 flex-1 rounded-full transition-colors"
              style={{
                background:
                  i < resume.currentSetIndex
                    ? 'var(--sr-success)'
                    : i === resume.currentSetIndex
                      ? 'var(--sr-brand-primary)'
                      : 'var(--sr-bg-elevated)',
              }}
            />
          ))}
        </div>
      </div>
    )
  }
  if (bucket === 'paused') {
    return (
      <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.homeProgramPaused}</p>
      </div>
    )
  }
  if (bucket === 'test_pending_ready') return null
  if (bucket === 'resting' || bucket === 'test_pending_rest') {
    if (hideRestPreview) return null
    const waitingRestDays = Math.max(1, daysLeft)
    return (
      <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3">
        <p className="sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
          {pl.restPrimaryLabel(stats?.nextWorkoutLabel ?? pl.restIn(daysLeft))}
        </p>
        <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {bucket === 'resting'
            ? pl.restGateHint(waitingRestDays)
            : pl.homeCardTestRestHint(stats?.nextWorkoutLabel ?? pl.today)}
        </p>
      </div>
    )
  }
  if (bucket === 'ready' && currentDaySets && setsTargetTotal != null) {
    return (
      <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-3">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">{pl.homeTodaySession}</p>
          <p className="sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
            {pl.plansDayReps(currentDaySets.length, setsTargetTotal)}
          </p>
        </div>
        <SetTargetsRow sets={currentDaySets} size="sm" />
      </div>
    )
  }
  return null
}

/** Contextual banner — at most one at a time, rendered between the preview
 *  and the CTA so the hint sits next to the action it refers to. */
export function ProgramCardBanner({
  hasResume,
  resumeStale,
  resting,
  isTestPending,
  bucket,
  trainDespiteRest,
  hideRestPreview,
  cycleAttempt,
  lastFailed,
  tipSuppression,
  onChangeLevel,
}: {
  hasResume: boolean
  resumeStale: boolean
  resting: boolean
  isTestPending: boolean
  bucket: ProgramBucket
  trainDespiteRest: boolean
  hideRestPreview: boolean
  cycleAttempt: number
  lastFailed: boolean
  tipSuppression: TipSuppression
  onChangeLevel: () => void
}) {
  let message: string | null = null
  let variant: 'warning' | 'info' = 'info'
  let actionLabel: string | undefined
  let onAction: (() => void) | undefined

  if (hasResume && resumeStale && !tipSuppression.stale) {
    variant = 'warning'
    message = pl.staleSession
  } else if (isTestPending && !tipSuppression.test) {
    message = pl.cycleCompleteHint
  } else if (hasResume && resting && !tipSuppression.stale) {
    message = pl.resumeDespiteRestHint
  } else if (
    !hasResume &&
    bucket === 'resting' &&
    !trainDespiteRest &&
    !hideRestPreview &&
    cycleAttempt >= 2 &&
    lastFailed &&
    !tipSuppression.level
  ) {
    message = pl.considerLowerLevel
    actionLabel = pl.menuChangeLevel
    onAction = onChangeLevel
  } else if (
    cycleAttempt >= 2 &&
    !hasResume &&
    bucket === 'ready' &&
    !tipSuppression.level &&
    lastFailed
  ) {
    message = pl.considerLowerLevel
    actionLabel = pl.menuChangeLevel
    onAction = onChangeLevel
  }

  if (!message) return null
  return (
    <div className="mt-2.5">
      <FeedbackBanner
        variant={variant}
        message={message}
        actionLabel={actionLabel}
        onAction={onAction}
        density="compact"
      />
    </div>
  )
}
