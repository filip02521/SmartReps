import type { HomeLoadResult } from '@/lib/home-summary'
import { getGreetingKey } from '@/lib/home-summary'
import { UserPlanBadge } from '@/components/pro/UserPlanBadge'
import { pl } from '@/i18n/pl'

type Summary = HomeLoadResult['summary']

export function HomeStatusHeader({
  summary,
  displayName,
}: {
  summary: Summary
  displayName?: string
}) {
  const greetingKey = getGreetingKey()
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
    </header>
  )
}
