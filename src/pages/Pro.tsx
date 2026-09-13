import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, Cloud, Layers, Loader2, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { PlanComparisonTable } from '@/components/pro/PlanComparisonTable'
import { PlanStatusCard } from '@/components/pro/PlanStatusCard'
import { PricingCards, type ProPlanId } from '@/components/pro/PricingCards'
import { pl } from '@/i18n/pl'
import { useSeo } from '@/hooks/useSeo'
import { AnalyticsEvents, track } from '@/lib/analytics'
import { FOCUS_RING, Z_TAB_BAR } from '@/lib/ui-chrome'
import { hasUsedTrial, startTrial, useIsTrial, usePlanBadgeState, useProFeatures } from '@/lib/subscription'
import { redirectToCheckout, redirectToPortal } from '@/lib/stripe-client'
import { refreshSubscriptionStatus } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'

/** Stripe is wired via Edge Functions; the env flag lets us dark-launch the
 *  /pro page (and keep trial opt-in working) while payments stay off. */
const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true'

/**
 * /pro — Free vs Pro comparison + pricing. Deep-linkable paywall page:
 * every ProTeaser and limit state links here via ?feature=<ProFeature>
 * which scrolls to and highlights the relevant comparison category.
 *
 * Layout: immersive centered hero (brand mark + glow) → plan status →
 * value highlights → full comparison table → pricing → trust row →
 * sticky CTA. Pro/lifetime users get "what you have" — no pricing.
 */
export default function ProPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const feature = params.get('feature')
  const source = params.get('source') ?? 'direct'

  const isPro = useProFeatures()
  const isTrial = useIsTrial()
  const planState = usePlanBadgeState()
  const status = useAppStore((s) => s.settings.subscriptionStatus)

  const [plan, setPlan] = useState<ProPlanId>('annual')
  const [trialBusy, setTrialBusy] = useState(false)
  const [billingBusy, setBillingBusy] = useState(false)
  const trackedRef = useRef(false)

  useSeo({ title: pl.seoProTitle, description: pl.seoProDescription, path: '/pro' })

  // Page view — once, with entry context for conversion analysis.
  // Also refresh the subscription status: the paywall is where a stale
  // local 'free' cache hurts most (e.g. Pro granted server-side since the
  // last sync). A flip re-renders the page into the "you have Pro" state.
  useEffect(() => {
    if (trackedRef.current) return
    trackedRef.current = true
    track(AnalyticsEvents.proPageView, { source, feature })
    void refreshSubscriptionStatus()
  }, [source, feature])

  // Deep-link: scroll the targeted comparison category into view.
  useEffect(() => {
    if (!feature) return
    const el = document.querySelector(`[data-pro-feature~="${CSS.escape(feature)}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [feature])

  // Stripe return: ?checkout=success|cancel, ?portal=returned.
  // Entitlement itself arrives via the webhook — we only toast + pull the
  // fresh status. The portal return needs its own refresh because the user
  // may have cancelled or changed plans inside the portal.
  const checkout = params.get('checkout')
  const portal = params.get('portal')
  useEffect(() => {
    if (checkout === 'success') {
      showToast(pl.proCheckoutSuccess, 'success')
      void refreshSubscriptionStatus()
    } else if (checkout === 'cancel') {
      showToast(pl.proCheckoutCanceled, 'info')
    } else if (portal === 'returned') {
      void refreshSubscriptionStatus()
    }
  }, [checkout, portal])

  const trialEligible = status === 'free' && !hasUsedTrial()
  // Active Pro/lifetime → no pricing; trial/free/expired/lapsed-trial → pricing.
  // Trial users see pricing so they can choose a plan when upgrading —
  // isPro is true for trial, but trial is temporary and the user needs
  // to pick a paid plan before the trial ends.
  const showPricing = !isPro || isTrial
  // Only paid Pro (recurring subscription) can be managed via the Stripe
  // portal. Lifetime is a one-time payment with nothing to cancel/update.
  const showManage = isPro && !isTrial && status !== 'lifetime'

  const handleCta = async () => {
    track(AnalyticsEvents.proCtaClick, {
      plan,
      kind: trialEligible ? 'trial' : showManage ? 'manage' : 'upgrade',
    })

    // Self-serve trial — no Stripe needed (migration 067 RPC). Works even
    // with billing disabled, so the primary CTA is never a dead end for
    // eligible users.
    if (trialEligible) {
      setTrialBusy(true)
      const result = await startTrial()
      setTrialBusy(false)
      if (result === 'ok') {
        showToast(pl.proTrialStarted, 'success')
        track(AnalyticsEvents.proTrialStart, { source })
        return // isPro flips → page re-renders into the "you have Pro" state
      }
      if (result === 'not_authenticated') {
        showToast(pl.proTrialLoginHint, 'info')
        navigate('/setup/login')
        return
      }
      if (result === 'already_used' || result === 'already_pro') {
        void refreshSubscriptionStatus() // heal a stale local status
        return
      }
      showToast(pl.proTrialStartError, 'error')
      return
    }

    if (!BILLING_ENABLED) return

    // Stripe Checkout / Customer Portal. The entitlement itself never
    // changes here — the stripe-webhook Edge Function is the only writer.
    setBillingBusy(true)
    try {
      const result = showManage
        ? await redirectToPortal()
        : await redirectToCheckout(plan)
      if (result.ok) return // browser is navigating to Stripe
      if (result.reason === 'already_pro') {
        void refreshSubscriptionStatus() // heal a stale local status
      } else if (result.reason === 'auth') {
        showToast(pl.proTrialLoginHint, 'info')
        navigate('/setup/login')
      } else {
        showToast(showManage
          ? result.reason === 'no_customer'
            ? pl.proPortalNoCustomer
            : pl.proPortalError
          : pl.proCheckoutError, 'error')
      }
    } finally {
      setBillingBusy(false)
    }
  }

  // Lifetime has nothing to manage (one-time payment) and nothing to buy
  // (already top tier) — hide the CTA entirely. Paid Pro needs the CTA
  // for "Manage subscription" (Customer Portal).
  const showCta = showManage || !isPro || isTrial || planState === 'expired'
  // The sticky bar also hosts the trial hint / "coming soon" message and
  // the "Continue free" button — keep it when any of those are visible.
  const showStickyBar = showCta || trialEligible || !BILLING_ENABLED || !isPro
  const ctaLabel = showManage
    ? pl.proManageSubscription
    : planState === 'expired'
      ? pl.proRenew
      : trialEligible
        ? pl.proTrialCta
        : pl.proUpgradeCta

  // Deep links can land here with no in-app history — fall back to home
  // instead of a dead back button.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
    if (idx > 0) navigate(-1)
    else navigate('/')
  }

  const highlights = [
    { icon: Sparkles, title: pl.proHighlightAi, desc: pl.proHighlightAiDesc },
    { icon: Layers, title: pl.proHighlightPlans, desc: pl.proHighlightPlansDesc },
    { icon: Cloud, title: pl.proHighlightSync, desc: pl.proHighlightSyncDesc },
  ]

  return (
    <div className={`mx-auto max-w-lg px-4 safe-top ${showStickyBar ? 'pb-44' : 'pb-8'}`}>
      {/* Slim top bar — back only; the hero carries the identity */}
      <div className="flex items-center pt-2">
        <button
          type="button"
          onClick={goBack}
          className={`flex min-h-12 min-w-12 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95 ${FOCUS_RING}`}
          aria-label={pl.back}
        >
          <ArrowLeft size={22} />
        </button>
      </div>

      {/* Hero — centered brand mark, radial glow, gradient wordmark */}
      <header className="relative flex flex-col items-center pt-4 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full"
          style={{
            background:
              'radial-gradient(circle, var(--sr-brand-primary-muted) 0%, transparent 70%)',
          }}
        />
        <AiCoachMark size="xl" pulse={!isPro} />
        <h1 className="mt-4 text-3xl font-bold tracking-tight">
          <span className="font-normal text-[var(--sr-text-primary)]">Smart</span>
          <span className="sr-gradient-text">Reps</span>
          <span className="text-[var(--sr-text-primary)]"> </span>
          <span className="sr-gradient-text font-extrabold">Pro</span>
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {isPro ? pl.proYouHaveProDesc : pl.proPageSubtitle}
        </p>
      </header>

      {/* Current plan status */}
      <div className="mt-6">
        <PlanStatusCard />
      </div>

      {/* Value highlights — scannable pitch before the detailed table.
          Trial users see the same list framed as "what you just unlocked"
          so the trial advertises the Pro value, not just enables it. */}
      {(!isPro || isTrial) && (
        <div className="mt-6">
          {isTrial && isPro && (
            <p className="sr-text-overline mb-3 text-[var(--sr-brand-primary)]">
              {pl.proTrialUnlockedTitle}
            </p>
          )}
        <ul className="flex flex-col gap-2.5">
          {highlights.map(({ icon: Icon, title, desc }) => (
            <li
              key={title}
              className="flex items-start gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3.5"
              style={{ boxShadow: 'var(--sr-shadow-card)' }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary-hover)]">
                <Icon size={20} aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-[var(--sr-text-primary)]">
                  {title}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--sr-text-secondary)]">
                  {desc}
                </span>
              </span>
            </li>
          ))}
        </ul>
        </div>
      )}

      {/* Comparison table — with deep-link category highlight */}
      <div className="mt-8">
        <h2 className="sr-text-overline mb-3 text-[var(--sr-text-muted)]">
          {pl.proComparisonTitle}
        </h2>
        <PlanComparisonTable highlightFeature={feature} />
      </div>

      {/* Pricing — visible for free/trial/expired; hidden for active Pro/lifetime */}
      {showPricing && (
        <div className="mt-8">
          <h2 className="sr-text-overline mb-3 text-[var(--sr-text-muted)]">
            {pl.proChoosePlan}
          </h2>
          <PricingCards
            selected={plan}
            onSelect={(p) => {
              setPlan(p)
              track(AnalyticsEvents.proPlanSelect, { plan: p })
            }}
            disabled={!BILLING_ENABLED}
          />
          <p className="mt-3 text-center text-xs leading-relaxed text-[var(--sr-text-muted)]">
            {pl.proLaunchOfferNote}
          </p>
        </div>
      )}

      {/* Trust row — hidden for Pro users (they already have it) */}
      {!isPro && (
      <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <li className="flex items-center gap-1.5 text-xs text-[var(--sr-text-secondary)]">
          <ShieldCheck size={15} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
          {pl.proSecurePayment}
        </li>
        <li className="flex items-center gap-1.5 text-xs text-[var(--sr-text-secondary)]">
          <Check size={15} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
          {pl.proCancelAnytime}
        </li>
        <li className="flex items-center gap-1.5 text-xs text-[var(--sr-text-secondary)]">
          <RefreshCw size={15} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
          <Link
            to="/setup/login"
            className="font-medium text-[var(--sr-brand-primary)] underline-offset-4 hover:underline"
          >
            {pl.proAlreadyHave}
          </Link>
        </li>
      </ul>
      )}

      {/* Legal */}
      <p className="mt-5 text-center text-xs text-[var(--sr-text-muted)]">
        <Link to="/terms" className="underline-offset-4 hover:underline">
          {pl.termsTitle}
        </Link>
        {' · '}
        <Link to="/privacy" className="underline-offset-4 hover:underline">
          {pl.privacyTitle}
        </Link>
      </p>

      {/* Sticky CTA — elevated bar above safe area; page has no tab bar.
          Hidden entirely for lifetime (nothing to buy, nothing to manage). */}
      {showStickyBar && (
      <div
        className="fixed inset-x-0 bottom-0 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-base)]/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur-md"
        style={{ zIndex: Z_TAB_BAR, boxShadow: 'var(--sr-shadow-nav)' }}
      >
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          {showCta && (
            <Button
              variant={showManage ? 'secondary' : 'primary'}
              size="touch"
              fullWidth
              disabled={trialBusy || billingBusy || (!BILLING_ENABLED && !trialEligible)}
              onClick={() => void handleCta()}
            >
              {(trialBusy || billingBusy) && (
                <Loader2 size={18} className="animate-spin" aria-hidden />
              )}
              {ctaLabel}
            </Button>
          )}
          {trialEligible ? (
            <p className="text-center text-xs text-[var(--sr-text-muted)]">
              {pl.proTrialHint}
            </p>
          ) : !BILLING_ENABLED ? (
            <p className="text-center text-xs text-[var(--sr-text-muted)]">
              {pl.proComingSoon}
            </p>
          ) : null}
          {!isPro && (
            <Button variant="ghost" fullWidth onClick={goBack}>
              {pl.proContinueFree}
            </Button>
          )}
        </div>
      </div>
      )}
    </div>
  )
}
