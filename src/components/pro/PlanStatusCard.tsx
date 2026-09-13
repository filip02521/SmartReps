import { Crown } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { dateBcp47 } from '@/lib/date-locale'
import { daysRemaining, usePlanBadgeState } from '@/lib/subscription'
import { useAppStore } from '@/stores/app-store'

export type PlanSummary = {
  chip: string
  detail: string | null
  tone: 'muted' | 'brand' | 'warning'
}

/** Shared plan-status copy/tone — used by PlanStatusCard and the merged
 *  services card on Profile. Five states: free / trial / pro / lifetime /
 *  expired. */
export function usePlanSummary(): PlanSummary {
  const expiresAt = useAppStore((s) => s.settings.subscriptionExpiresAt)
  const state = usePlanBadgeState()
  const days = daysRemaining(expiresAt)

  if (state === 'lifetime') {
    return { chip: pl.proSubscriptionLifetime, detail: null, tone: 'brand' }
  }
  if (state === 'trial') {
    return { chip: pl.proBadge, detail: pl.proSubscriptionTrial(days ?? 0), tone: 'brand' }
  }
  if (state === 'pro') {
    return {
      chip: pl.proBadge,
      detail: expiresAt
        ? pl.proSubscriptionExpires(new Date(expiresAt).toLocaleDateString(dateBcp47()))
        : pl.proSubscriptionActive,
      tone: 'brand',
    }
  }
  if (state === 'expired') {
    // 'expired' or a trial whose window passed (status stays 'trial' until
    // the webhook marks it expired) — same renewal prompt either way.
    return { chip: pl.proSubscriptionExpired, detail: null, tone: 'warning' }
  }
  return { chip: pl.proSubscriptionFree, detail: null, tone: 'muted' }
}

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
  const { chip, detail, tone } = usePlanSummary()

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
