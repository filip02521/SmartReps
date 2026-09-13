import { Check } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

export type ProPlanId = 'monthly' | 'annual' | 'lifetime'

type PlanDef = {
  id: ProPlanId
  name: string
  price: string
  /** Small muted suffix under the price ("/ rok", "/ mies."). */
  priceSuffix?: string
  /** Secondary line under the plan name (per-month equivalent / savings). */
  sub?: string
  /** Struck-through anchor price above the real price (launch offer). */
  strikePrice?: string
  /** Promo pill under the price (e.g. "Cena startowa"). */
  promoLabel?: string
  badge?: string
  bestValue?: boolean
}

/**
 * Plan picker — vertical radiogroup, annual first and preselected
 * (annual-first per business model). Best-value card gets a gradient
 * ring + glow; prices come from i18n keys so a price change is a
 * copy edit, not a code change.
 */
export function PricingCards({
  selected,
  onSelect,
  disabled,
}: {
  selected: ProPlanId
  onSelect: (plan: ProPlanId) => void
  /** Billing not wired / offline — cards stay visible but inert. */
  disabled?: boolean
}) {
  const plans: PlanDef[] = [
    {
      id: 'annual',
      name: pl.proPlanAnnual,
      price: pl.proPriceAnnual,
      priceSuffix: pl.proPerYear,
      sub: `${pl.proPriceAnnualMonthly} · ${pl.proPlanAnnualSavings}`,
      strikePrice: pl.proPriceAnnualFuture,
      promoLabel: pl.proPriceAnnualPromo,
      badge: pl.proBestValue,
      bestValue: true,
    },
    {
      id: 'monthly',
      name: pl.proPlanMonthly,
      price: pl.proPriceMonthly,
      priceSuffix: pl.proPerMonth,
    },
    {
      id: 'lifetime',
      name: pl.proPlanLifetime,
      price: pl.proPriceLifetime,
      sub: pl.proOneTime,
    },
  ]

  return (
    <div role="radiogroup" aria-label={pl.proChoosePlan} className="flex flex-col gap-3">
      {plans.map((plan) => {
        const isSelected = plan.id === selected
        const card = (
          <button
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onSelect(plan.id)}
            className={cn(
              'relative flex w-full items-center gap-3.5 px-4 py-4 text-left transition-all',
              'disabled:cursor-not-allowed disabled:opacity-60',
              plan.bestValue
                ? // Sits inside a 1.5px gradient ring — shave the radius so the
                  // inner corners sit flush against the ring.
                  'rounded-[calc(var(--sr-radius-lg)-1.5px)] bg-[var(--sr-bg-elevated)]'
                : cn(
                    'rounded-[var(--sr-radius-lg)] border bg-[var(--sr-bg-elevated)]',
                    isSelected
                      ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]/40'
                      : 'border-[var(--sr-border-subtle)] hover:border-[var(--sr-border-strong)]',
                  ),
              FOCUS_RING,
            )}
          >
            <span
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                isSelected
                  ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary)]'
                  : 'border-[var(--sr-border-strong)]',
              )}
              aria-hidden
            >
              {isSelected && <Check size={12} className="text-white" strokeWidth={3.5} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--sr-text-primary)]">
                {plan.name}
              </span>
              {plan.sub && (
                <span className="mt-0.5 block text-xs text-[var(--sr-text-secondary)]">
                  {plan.sub}
                </span>
              )}
            </span>
            <span className="shrink-0 text-right">
              {plan.strikePrice && (
                <span className="block text-xs font-medium leading-tight text-[var(--sr-text-muted)] line-through">
                  {plan.strikePrice}
                </span>
              )}
              <span
                className={cn(
                  'block text-lg font-bold leading-tight',
                  plan.bestValue || isSelected
                    ? 'text-[var(--sr-brand-primary-hover)]'
                    : 'text-[var(--sr-text-primary)]',
                )}
              >
                {plan.price}
              </span>
              {plan.priceSuffix && (
                <span className="block text-[0.625rem] font-medium text-[var(--sr-text-muted)]">
                  {plan.priceSuffix}
                </span>
              )}
              {plan.promoLabel && (
                <span className="mt-1 inline-block rounded-[var(--sr-radius-full)] bg-[var(--sr-success)] px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-[var(--sr-bg-base)]">
                  {plan.promoLabel}
                </span>
              )}
            </span>
          </button>
        )

        // Best-value card: gradient ring (padding trick) + glow + badge.
        if (!plan.bestValue) return <div key={plan.id}>{card}</div>
        return (
          <div
            key={plan.id}
            className={cn(
              'relative rounded-[var(--sr-radius-lg)] p-[1.5px] transition-shadow',
              isSelected && 'shadow-[var(--sr-shadow-glow)]',
            )}
            style={{ background: 'var(--sr-brand-gradient)' }}
          >
            {plan.badge && (
              <span className="absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[var(--sr-radius-full)] bg-[image:var(--sr-brand-gradient)] px-3 py-1 text-[0.625rem] font-bold uppercase tracking-wider text-white shadow-md">
                {plan.badge}
              </span>
            )}
            {card}
          </div>
        )
      })}
    </div>
  )
}
