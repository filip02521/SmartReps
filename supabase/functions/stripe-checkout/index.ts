// Edge Function: stripe-checkout
// Deploy: supabase functions deploy stripe-checkout
//   (verify_jwt ENABLED — the function requires the caller's user JWT;
//   gateway verification is the first auth layer, getUser() the second.)
// Auth: user JWT (Authorization: Bearer <access_token>)
// Secrets:
//   STRIPE_SECRET_KEY       — sk_live_... / sk_test_...
//   STRIPE_PRICE_MONTHLY    — price_... for the monthly subscription
//   STRIPE_PRICE_ANNUAL     — price_... for the annual subscription
//   STRIPE_PRICE_LIFETIME   — price_... for the one-time lifetime payment
//   APP_BASE_URL            — e.g. https://smartreps.app (success/cancel URLs)
//
// Creates a Stripe Checkout Session for the authenticated user and returns
// the hosted-page URL. The user's identity is bound via client_reference_id
// + metadata.user_id so the webhook can resolve the profile row without
// trusting anything the client sent.

import Stripe from 'npm:stripe@17'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

type PlanId = 'monthly' | 'annual' | 'lifetime'

function priceForPlan(plan: PlanId): string | null {
  switch (plan) {
    case 'monthly':
      return Deno.env.get('STRIPE_PRICE_MONTHLY') ?? null
    case 'annual':
      return Deno.env.get('STRIPE_PRICE_ANNUAL') ?? null
    case 'lifetime':
      return Deno.env.get('STRIPE_PRICE_LIFETIME') ?? null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const appBaseUrl = (Deno.env.get('APP_BASE_URL') ?? '').replace(/\/+$/, '')
  if (!stripeKey || !appBaseUrl) {
    console.error('stripe-checkout: STRIPE_SECRET_KEY or APP_BASE_URL missing')
    return json(503, { error: 'billing_not_configured' })
  }

  // ── Auth: user JWT required ──
  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) return json(401, { error: 'unauthorized' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData, error: userError } = await userClient.auth.getUser(jwt)
  if (userError || !userData.user) return json(401, { error: 'unauthorized' })
  const userId = userData.user.id

  // ── Parse + validate plan ──
  let body: { plan?: unknown }
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'bad_request' })
  }
  const plan = body.plan as PlanId
  if (plan !== 'monthly' && plan !== 'annual' && plan !== 'lifetime') {
    return json(400, { error: 'unknown_plan' })
  }
  const priceId = priceForPlan(plan)
  if (!priceId) {
    console.error(`stripe-checkout: price env for ${plan} missing`)
    return json(503, { error: 'billing_not_configured' })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  // Reuse the existing Stripe customer if the user already has one —
  // prevents duplicate customers on repeat checkouts.
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, subscription_status, subscription_expires_at')
    .eq('id', userId)
    .maybeSingle()

  // Already-covered users get bounced — checkout would double-bill them.
  // Trial users are intentionally NOT blocked: converting a trial early is
  // the whole point of the trial.
  const status = profile?.subscription_status as string | undefined
  const expiresAt = profile?.subscription_expires_at
    ? new Date(profile.subscription_expires_at as string)
    : null
  const isCovered =
    status === 'lifetime' ||
    (status === 'pro' && (!expiresAt || expiresAt > new Date()))
  if (isCovered) {
    return json(409, { error: 'already_pro' })
  }

  const stripe = new Stripe(stripeKey)
  const existingCustomer = profile?.stripe_customer_id as string | null | undefined

  // DB status can lag Stripe (e.g. a past_due sub still retrying) — if this
  // customer already owns a live subscription, a new checkout would create a
  // SECOND subscription and double-bill. Block it; the user manages the
  // existing one via the portal instead.
  if (existingCustomer && plan !== 'lifetime') {
    try {
      for (const subStatus of ['active', 'trialing', 'past_due'] as const) {
        const subs = await stripe.subscriptions.list({
          customer: existingCustomer,
          status: subStatus,
          limit: 1,
        })
        if (subs.data.length > 0) {
          return json(409, { error: 'already_pro' })
        }
      }
    } catch (err) {
      // Fail open — a transient Stripe API error shouldn't block checkout;
      // the webhook reconciles either way.
      console.error('stripe-checkout: subscription list failed', err)
    }
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: plan === 'lifetime' ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      // Identity binding — the webhook resolves the profile from this.
      client_reference_id: userId,
      customer: existingCustomer ?? undefined,
      customer_email: existingCustomer ? undefined : (userData.user.email ?? undefined),
      metadata: { user_id: userId, plan },
      subscription_data:
        plan === 'lifetime' ? undefined : { metadata: { user_id: userId, plan } },
      success_url: `${appBaseUrl}/pro?checkout=success`,
      cancel_url: `${appBaseUrl}/pro?checkout=cancel`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: { enabled: true },
      automatic_tax: { enabled: false }, // flip to true when VAT config is set in Stripe
    })
    return json(200, { url: session.url })
  } catch (err) {
    console.error('stripe-checkout: session create failed', err)
    return json(502, { error: 'stripe_error' })
  }
})
