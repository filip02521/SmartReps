import { Crown } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { dateBcp47 } from '@/lib/date-locale'
import { daysRemaining, usePlanBadgeState } from '@/lib/subscription'
import { useAppStore } from '@/stores/app-store'

/**
 * Current plan status — chip + label + optional action slot.
 * Five states: free / trial (days left) / pro (expiry) / lifetime / expired.
 * Used on /pro and in Profile.
 */
export function PlanStatusCard({
  action,
  className,
}: {
  /** CTA rendered on the right (e.g. "Zobacz Pro" button). */
  action?: React.ReactNode
  className?: string
}) {
  const expiresAt = useAppStore((s) => s.settings.subscriptionExpiresAt)
  const state = usePlanBadgeState()

  const days = daysRemaining(expiresAt)

  let chip: string
  let detail: string | null = null
  let tone: 'muted' | 'brand' | 'warning' = 'muted'

  if (state === 'lifetime') {
    chip = pl.proSubscriptionLifetime
    tone = 'brand'
  } else if (state === 'trial') {
    chip = pl.proBadge
    detail = pl.proSubscriptionTrial(days ?? 0)
    tone = 'brand'
  } else if (state === 'pro') {
    chip = pl.proBadge
    detail = expiresAt
      ? pl.proSubscriptionExpires(new Date(expiresAt).toLocaleDateString(dateBcp47()))
      : pl.proSubscriptionActive
    tone = 'brand'
  } else if (state === 'expired') {
    // 'expired' or a trial whose window passed (status stays 'trial' until
    // the webhook marks it expired) — same renewal prompt either way.
    chip = pl.proSubscriptionExpired
    tone = 'warning'
  } else {
    chip = pl.proSubscriptionFree
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 py-3',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
          tone === 'brand'
            ? 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary-hover)]'
            : tone === 'warning'
              ? 'bg-[var(--sr-warning-muted)] text-[var(--sr-warning)]'
              // Card container is already bg-elevated — a same-color icon
              // backdrop would be invisible, so muted tone drops one level.
              : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
        )}
      >
        <Crown size={20} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
          {pl.proYourPlan}
        </p>
        <p
          className={cn(
            'truncate text-sm font-semibold',
            tone === 'brand'
              ? 'text-[var(--sr-brand-primary-hover)]'
              : tone === 'warning'
                ? 'text-[var(--sr-warning)]'
                : 'text-[var(--sr-text-primary)]',
          )}
        >
          {chip}
        </p>
        {detail && (
          <p className="truncate text-xs text-[var(--sr-text-secondary)]">{detail}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
