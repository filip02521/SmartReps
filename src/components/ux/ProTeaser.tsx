import { Check, Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { useProFeatures } from '@/lib/subscription'

/**
 * Paywall teaser — shown when a free user tries to use a Pro feature.
 *
 * Etap 0: component exists but is not triggered (no gating enforced).
 * Etap 1: shown when isFeatureBlocked() returns true.
 *
 * Lists all Pro benefits, with trial CTA (opt-in) and upgrade CTA.
 * Pricing page (/pricing) will be implemented in Etap 1 with Stripe Checkout.
 */
export function ProTeaser({
  open,
  onClose,
  feature: _feature,
}: {
  open: boolean
  onClose: () => void
  /** Which feature triggered the teaser — for analytics/context. */
  feature?: string
}) {
  const isPro = useProFeatures()

  // If user is already Pro, don't show the teaser (defensive)
  if (isPro) return null

  const features = [
    pl.proFeatureHostedAi,
    pl.proFeatureUnlimitedPlans,
    pl.proFeatureAdvancedAnalytics,
    pl.proFeatureCloudSync,
    pl.proFeatureWebPush,
    pl.proFeatureExport,
    pl.proFeatureUnlimitedPublications,
    pl.proFeatureVerifiedBadge,
    pl.proFeatureManualShowcase,
  ]

  return (
    <Sheet open={open} onClose={onClose} title={pl.proUpgradeTitle} showClose>
      <div className="flex flex-col gap-5">
        {/* Hero */}
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)]">
            <Sparkles size={24} className="text-[var(--sr-brand-primary-hover)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[var(--sr-text-primary)]">
              {pl.proUpgradeTitle}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">
              {pl.proUpgradeDescription}
            </p>
          </div>
        </div>

        {/* Feature list */}
        <ul className="flex flex-col gap-2.5">
          {features.map((featureLabel) => (
            <li key={featureLabel} className="flex items-start gap-2.5">
              <Check
                size={18}
                className="mt-0.5 shrink-0 text-[var(--sr-success)]"
                aria-hidden
              />
              <span className="text-sm text-[var(--sr-text-primary)]">
                {featureLabel}
              </span>
            </li>
          ))}
        </ul>

        {/* CTAs — Etap 1 will wire to Stripe Checkout */}
        <div className="flex flex-col gap-2.5">
          <Button
            variant="primary"
            fullWidth
            size="touch"
            onClick={() => {
              // Etap 1: redirect to Stripe Checkout with trial_period_days=14
              // For now: close teaser (pricing page not implemented yet)
              onClose()
            }}
          >
            {pl.proTrialCta}
          </Button>
          <p className="text-center text-xs text-[var(--sr-text-muted)]">
            {pl.proTrialHint}
          </p>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => {
              // Etap 1: redirect to Stripe Checkout (annual, no trial)
              onClose()
            }}
          >
            {pl.proUpgradeCta}
          </Button>
          <Button variant="ghost" fullWidth onClick={onClose}>
            {pl.proTeaserClose}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
