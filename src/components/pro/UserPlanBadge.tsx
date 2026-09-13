import { Link } from 'react-router-dom'
import { Crown, Hourglass } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import {
  TRIAL_ENDING_SOON_DAYS,
  daysRemaining,
  usePlanBadgeState,
} from '@/lib/subscription'
import { useAppStore } from '@/stores/app-store'

/**
 * Plan badge — compact chip rendered next to the user's name (Dashboard
 * greeting, Profile hero). Reflects the subscription state and deep-links to
 * /pro so the chip doubles as a status entry point (pro/lifetime), a trial
 * countdown, a renewal prompt (expired) or an upgrade affordance (free).
 *
 * Tones: brand gradient = active paid access; warning = trial ending soon
 * or lapsed; ghost outline = free (subtle upsell).
 */
export function UserPlanBadge({ className }: { className?: string }) {
  const state = usePlanBadgeState()
  const expiresAt = useAppStore((s) => s.settings.subscriptionExpiresAt)
  const days = daysRemaining(expiresAt)
  const trialEndingSoon =
    state === 'trial' && days != null && days <= TRIAL_ENDING_SOON_DAYS

  const tone =
    state === 'free'
      ? 'ghost'
      : state === 'expired' || trialEndingSoon
        ? 'warning'
        : 'brand'

  const label =
    state === 'trial'
      ? days != null
        ? pl.proBadgeTrialDays(days)
        : pl.proBadgeTrial
      : state === 'expired'
        ? pl.proBadgeExpired
        : pl.proBadge

  const aria =
    state === 'trial'
      ? pl.planBadgeAriaTrial(days ?? 0)
      : state === 'pro' || state === 'lifetime'
        ? pl.planBadgeAriaPro
        : state === 'expired'
          ? pl.planBadgeAriaExpired
          : pl.planBadgeAriaFree

  const Icon = state === 'trial' || state === 'expired' ? Hourglass : Crown

  return (
    <Link
      to="/pro?source=plan_badge"
      aria-label={aria}
      title={aria}
      className={cn(
        FOCUS_RING,
        'inline-flex shrink-0 select-none items-center gap-1 rounded-[var(--sr-radius-full)] px-2 py-1 text-[0.625rem] font-bold uppercase leading-none tracking-wide transition-transform active:scale-95',
        tone === 'brand' && 'bg-[image:var(--sr-brand-gradient)] text-white',
        tone === 'warning' && 'bg-[var(--sr-warning-muted)] text-[var(--sr-warning)]',
        tone === 'ghost' &&
          'border border-[var(--sr-border-strong)] text-[var(--sr-text-muted)] transition-colors hover:border-[var(--sr-brand-primary)] hover:text-[var(--sr-brand-primary)]',
        className,
      )}
    >
      <Icon size={10} strokeWidth={2.5} aria-hidden />
      {label}
    </Link>
  )
}
