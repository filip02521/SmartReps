// Stripe client helpers — thin fetch wrappers over the billing Edge
// Functions. Only called when VITE_BILLING_ENABLED=true; all entitlement
// changes happen exclusively via the stripe-webhook function, never here.

import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type { ProPlanId } from '@/components/pro/PricingCards'

export type BillingResult =
  | { ok: true; url: string }
  | { ok: false; reason: 'auth' | 'not_configured' | 'already_pro' | 'no_customer' | 'error' }

async function callBillingFunction(
  fn: 'stripe-checkout' | 'stripe-portal',
  body: Record<string, unknown>,
): Promise<BillingResult> {
  if (!isSupabaseConfigured) return { ok: false, reason: 'error' }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { ok: false, reason: 'auth' }

  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  let resp: Response
  try {
    resp = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify(body),
    })
  } catch {
    return { ok: false, reason: 'error' }
  }

  if (resp.status === 401) return { ok: false, reason: 'auth' }
  if (resp.status === 503) return { ok: false, reason: 'not_configured' }
  if (resp.status === 409) return { ok: false, reason: 'already_pro' }
  if (resp.status === 404) return { ok: false, reason: 'no_customer' }
  if (!resp.ok) return { ok: false, reason: 'error' }

  try {
    const json = (await resp.json()) as { url?: string }
    return json.url ? { ok: true, url: json.url } : { ok: false, reason: 'error' }
  } catch {
    return { ok: false, reason: 'error' }
  }
}

/** Redirect the browser to Stripe Checkout for the selected plan. */
export async function redirectToCheckout(plan: ProPlanId): Promise<BillingResult> {
  const result = await callBillingFunction('stripe-checkout', { plan })
  if (result.ok) window.location.assign(result.url)
  return result
}

/** Redirect the browser to the Stripe Customer Portal (manage/cancel). */
export async function redirectToPortal(): Promise<BillingResult> {
  const result = await callBillingFunction('stripe-portal', {})
  if (result.ok) window.location.assign(result.url)
  return result
}
