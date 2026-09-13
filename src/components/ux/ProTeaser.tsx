import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { hasUsedTrial, startTrial, usePlanBadgeState, useProFeatures } from '@/lib/subscription'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { AnalyticsEvents, track } from '@/lib/analytics'
import { refreshSubscriptionStatus } from '@/lib/sync'
import type { ProFeature } from '@/lib/feature-gating'

/** Contextual headline per gated feature — resolved at render time so the
 *  i18n proxy reflects the active language (a module-level map would freeze
 *  whatever dict was active at import). Previously dead proLimit* keys. */
function featureCopy(feature: ProFeature | string | undefined) {
  switch (feature) {
    case 'hostedAi':
      return { title: pl.proLimitHostedAiTitle, desc: pl.proLimitHostedAiDesc }
    case 'unlimitedCustomPlans':
      return { title: pl.proLimitCustomPlansTitle, desc: pl.proLimitCustomPlansDesc }
    case 'advancedAnalytics':
      return {
        title: pl.proLimitAdvancedAnalyticsTitle,
        desc: pl.proLimitAdvancedAnalyticsDesc,
      }
    // 'cloudSync' intentionally has no case — sync is free, so nothing gates
    // on it; a deep link falls through to the generic upgrade copy.
    case 'webPush':
      return { title: pl.proLimitWebPushTitle, desc: pl.proLimitWebPushDesc }
    case 'export':
      return { title: pl.proLimitExportTitle, desc: pl.proLimitExportDesc }
    case 'unlimitedPublications':
      return {
        title: pl.proLimitPublicationsTitle,
        desc: pl.proLimitPublicationsDesc,
      }
    default:
      return { title: pl.proUpgradeTitle, desc: pl.proUpgradeDescription }
  }
}

/**
 * Paywall teaser — shown when a free user tries to use a Pro feature.
 * Contextual headline per feature (proLimit* copy), benefit list, trial +
 * upgrade CTAs (placeholder until Stripe), and a link to the full /pro
 * comparison page.
 */
export function ProTeaser({
  open,
  onClose,
  feature,
}: {
  open: boolean
  onClose: () => void
  /** Which feature triggered the teaser — contextual headline + /pro deep link. */
  feature?: ProFeature | string
}) {
  const isPro = useProFeatures()
  const planState = usePlanBadgeState()
  const status = useAppStore((s) => s.settings.subscriptionStatus)
  const navigate = useNavigate()
  const trackedRef = useRef(false)
  const [trialBusy, setTrialBusy] = useState(false)

  // Track impressions once per open — conversion funnel starts here.
  // Also refresh subscription status: a server-side grant (Stripe webhook,
  // admin change) since the last sync would otherwise leave a stale 'free'
  // cache showing a paywall to someone who already paid. If the refresh
  // flips status to Pro, the isPro guard below hides the sheet.
  useEffect(() => {
    if (open && !trackedRef.current) {
      trackedRef.current = true
      track(AnalyticsEvents.proTeaserShown, { feature: feature ?? 'generic' })
      void refreshSubscriptionStatus()
    }
    if (!open) trackedRef.current = false
  }, [open, feature])

  // If user is already Pro, don't show the teaser (defensive)
  if (isPro) return null

  const copy = featureCopy(feature)

  // Mirror Pro.tsx's eligibility check — a user who already used their
  // trial (or whose subscription lapsed) must see "Renew"/"Upgrade", not
  // "Start free trial" again.
  const trialEligible = status === 'free' && !hasUsedTrial()
  // planBadgeState covers 'expired', lapsed trial AND lapsed 'pro' (past
  // expires_at before the server flips the status).
  const isExpired = planState === 'expired'
  const primaryCtaLabel = trialEligible
    ? pl.proTrialCta
    : isExpired
      ? pl.proRenew
      : pl.proUpgradeCta

  // Pro-only benefits — cloud sync and manual showcase are intentionally
  // absent (free for all); verified badge is not implemented so we don't
  // advertise it.
  const features = [
    pl.proFeatureHostedAi,
    pl.proFeatureUnlimitedPlans,
    pl.proFeatureAdvancedAnalytics,
    pl.proFeatureWebPush,
    pl.proFeatureExport,
    pl.proFeatureUnlimitedPublications,
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
              {copy.title}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">
              {copy.desc}
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

        {/* Full comparison link — close the sheet first so it doesn't float
            above the /pro page (Z_SHEET > page chrome). */}
        <button
          type="button"
          className="self-center text-sm font-medium text-[var(--sr-brand-primary)] underline-offset-4 hover:underline"
          onClick={() => {
            onClose()
            navigate(feature ? `/pro?feature=${feature}&source=teaser` : '/pro?source=teaser')
          }}
        >
          {pl.proCompareFull}
        </button>

        {/* CTAs — trial works self-serve (no Stripe); upgrade leads to /pro */}
        <div className="flex flex-col gap-2.5">
          <Button
            variant="primary"
            fullWidth
            size="touch"
            disabled={trialBusy}
            onClick={() => {
              if (trialEligible) {
                setTrialBusy(true)
                void startTrial().then((result) => {
                  setTrialBusy(false)
                  if (result === 'ok') {
                    showToast(pl.proTrialStarted, 'success')
                    track(AnalyticsEvents.proTrialStart, { source: 'teaser' })
                    onClose() // isPro flips — the gated feature unlocks
                  } else if (result === 'not_authenticated') {
                    showToast(pl.proTrialLoginHint, 'info')
                    onClose()
                    navigate('/setup/login')
                  } else if (result === 'already_used' || result === 'already_pro') {
                    onClose()
                    void refreshSubscriptionStatus()
                  } else {
                    showToast(pl.proTrialStartError, 'error')
                  }
                })
              } else {
                // Upgrade/renew — no billing yet, so send to the full /pro
                // page (shows pricing + "coming soon" state) instead of a
                // dead close.
                onClose()
                navigate(feature ? `/pro?feature=${feature}&source=teaser` : '/pro?source=teaser')
              }
            }}
          >
            {trialBusy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {primaryCtaLabel}
          </Button>
          {trialEligible && (
            <>
              <p className="text-center text-xs text-[var(--sr-text-muted)]">
                {pl.proTrialHint}
              </p>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => {
                  onClose()
                  navigate(feature ? `/pro?feature=${feature}&source=teaser` : '/pro?source=teaser')
                }}
              >
                {pl.proUpgradeCta}
              </Button>
            </>
          )}
          <Button variant="ghost" fullWidth onClick={onClose}>
            {pl.proTeaserClose}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
