// Edge Function: stripe-webhook
// Deploy: supabase functions deploy stripe-webhook --no-verify-jwt
//   (--no-verify-jwt is REQUIRED: Stripe signs the body, it does not send a
//   Supabase user JWT. Signature verification replaces JWT auth.)
// Secrets:
//   STRIPE_SECRET_KEY         — sk_live_... / sk_test_...
//   STRIPE_WEBHOOK_SECRET     — whsec_... from the Dashboard endpoint
//   STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL — for plan name resolution
// Stripe endpoint config (Dashboard → Developers → Webhooks):
//   URL: https://<project>.supabase.co/functions/v1/stripe-webhook
//   Events: checkout.session.completed,
//           checkout.session.async_payment_succeeded,
//           checkout.session.async_payment_failed,
//           customer.subscription.created, customer.subscription.updated,
//           customer.subscription.deleted, invoice.payment_failed
//
// Maps Stripe state into profiles.subscription_status / subscription_expires_at
// and writes an audit row to subscription_events per processed event.
// Idempotent: stripe_event_id is unique in subscription_events — a retried
// event is a no-op. Out-of-order events are handled by always writing the
// CURRENT Stripe truth for the subscription, never diffs.

import Stripe from 'npm:stripe@17'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

type Admin = ReturnType<typeof createClient>

async function alreadyProcessed(
  admin: Admin,
  eventId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('subscription_events')
    .select('id')
    .eq('stripe_event_id', eventId)
    .limit(1)
  return (data?.length ?? 0) > 0
}

async function recordEvent(
  admin: Admin,
  userId: string,
  eventType: string,
  eventId: string,
  plan?: string | null,
): Promise<void> {
  // Unique stripe_event_id makes retries no-ops; ignore the conflict error.
  const { error } = await admin.from('subscription_events').insert({
    user_id: userId,
    event_type: eventType,
    plan: plan ?? null,
    source: 'stripe',
    stripe_event_id: eventId,
  })
  if (error) console.error('subscription_events insert failed', error.message)
}

async function setSubscription(
  admin: Admin,
  userId: string,
  status: string,
  expiresAt: string | null,
): Promise<void> {
  // Never downgrade lifetime — a manual lifetime grant or completed one-time
  // payment must survive subscription churn / stale events.
  const { data: current } = await admin
    .from('profiles')
    .select('subscription_status')
    .eq('id', userId)
    .maybeSingle()
  if (current?.subscription_status === 'lifetime' && status !== 'lifetime') {
    return
  }
  const { error } = await admin
    .from('profiles')
    .update({
      subscription_status: status,
      subscription_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
  if (error) console.error('profiles subscription update failed', error.message)
}

async function saveCustomerId(
  admin: Admin,
  userId: string,
  customerId: string,
): Promise<void> {
  await admin
    .from('profiles')
    .update({ stripe_customer_id: customerId })
    .eq('id', userId)
    .is('stripe_customer_id', null)
}

/** Resolve the profile id for a Stripe object: metadata → client_reference_id → customer lookup. */
async function resolveUserId(
  admin: Admin,
  stripe: Stripe,
  metaUserId: string | undefined,
  clientRefId: string | undefined,
  customerId: string | undefined,
): Promise<string | null> {
  if (metaUserId) return metaUserId
  if (clientRefId) return clientRefId
  if (customerId) {
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    if (data?.id) return data.id as string
    // Last resort: customer object itself may carry metadata.
    try {
      const customer = await stripe.customers.retrieve(customerId)
      if (!('deleted' in customer && customer.deleted)) {
        const uid = (customer as Stripe.Customer).metadata?.user_id
        if (uid) return uid
      }
    } catch {
      /* fall through */
    }
  }
  return null
}

function planNameFromPrice(
  priceId: string | undefined,
): string {
  if (!priceId) return 'pro_monthly'
  return priceId === Deno.env.get('STRIPE_PRICE_ANNUAL')
    ? 'pro_annual'
    : 'pro_monthly'
}

/**
 * True when the customer owns ANOTHER subscription that is currently
 * active/trialing. Guards against out-of-order events: when a user cancels
 * sub A and later buys sub B, a late 'deleted'/'canceled' event for A must
 * not downgrade the access B already granted.
 */
async function hasOtherLiveSubscription(
  stripe: Stripe,
  customerId: string | undefined,
  excludeSubId: string,
): Promise<boolean> {
  if (!customerId) return false
  try {
    for (const status of ['active', 'trialing'] as const) {
      const list = await stripe.subscriptions.list({
        customer: customerId,
        status,
        limit: 10,
      })
      if (list.data.some((s) => s.id !== excludeSubId)) return true
    }
  } catch (err) {
    // Fail closed toward keeping access — a wrongly kept 'pro' is cheaper
    // than wrongly revoking a paying user; the next real event reconciles.
    console.error('stripe-webhook: subscription list failed', err)
    return true
  }
  return false
}

/** current_period_end lives on the item in API 2025-03+ (basil), on the sub before. */
function periodEndIso(sub: Stripe.Subscription): string | null {
  const itemEnd = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)
    ?.current_period_end
  const legacyEnd = (sub as { current_period_end?: number }).current_period_end
  const ts = itemEnd ?? legacyEnd
  return ts ? new Date(ts * 1000).toISOString() : null
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!stripeKey || !webhookSecret) {
    console.error('stripe-webhook: secrets missing')
    return json(503, { error: 'billing_not_configured' })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return json(400, { error: 'no_signature' })

  const stripe = new Stripe(stripeKey)
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    console.error('stripe-webhook: signature verification failed', err)
    return json(400, { error: 'invalid_signature' })
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  if (await alreadyProcessed(admin, event.id)) {
    return json(200, { received: true, duplicate: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        const userId = await resolveUserId(
          admin,
          stripe,
          session.metadata?.user_id,
          session.client_reference_id ?? undefined,
          customerId,
        )
        if (!userId) {
          console.error('stripe-webhook: cannot resolve user for session', session.id)
          return json(200, { received: true, orphan: true })
        }
        if (customerId) await saveCustomerId(admin, userId, customerId)

        if (session.mode === 'payment') {
          // One-time payment = lifetime — but ONLY once money is in. Async
          // payment methods (Przelewy24, BLIK, bank transfer) fire
          // checkout.session.completed with payment_status='unpaid' and settle
          // later via checkout.session.async_payment_succeeded; granting on
          // the unpaid event would hand out free lifetime access.
          if (session.payment_status !== 'paid') {
            await recordEvent(admin, userId, 'payment_pending', event.id, 'lifetime')
            break
          }
          await setSubscription(admin, userId, 'lifetime', null)
          await recordEvent(admin, userId, 'lifetime_purchased', event.id, 'lifetime')
        } else if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          const plan = planNameFromPrice(sub.items.data[0]?.price.id)
          // Grant only when the first invoice actually cleared — a session
          // can complete with the subscription stuck in 'incomplete' (failed
          // first payment), which must not hand out Pro.
          if (sub.status === 'active' || sub.status === 'trialing') {
            await setSubscription(admin, userId, 'pro', periodEndIso(sub))
            await recordEvent(admin, userId, 'subscription_created', event.id, plan)
          } else {
            await recordEvent(admin, userId, 'subscription_pending', event.id, plan)
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const userId = await resolveUserId(
          admin,
          stripe,
          sub.metadata?.user_id,
          undefined,
          customerId,
        )
        if (!userId) {
          console.error('stripe-webhook: cannot resolve user for sub', sub.id)
          return json(200, { received: true, orphan: true })
        }
        if (customerId) await saveCustomerId(admin, userId, customerId)

        const plan = planNameFromPrice(sub.items.data[0]?.price.id)
        if (sub.status === 'active' || sub.status === 'trialing') {
          await setSubscription(admin, userId, 'pro', periodEndIso(sub))
          await recordEvent(admin, userId, 'subscription_renewed', event.id, plan)
        } else if (sub.status === 'incomplete') {
          // First payment still processing — Stripe event order is not
          // guaranteed, so a late 'incomplete' must not overwrite a 'pro'
          // grant that checkout.session.completed already wrote.
          await recordEvent(admin, userId, 'subscription_pending', event.id, plan)
        } else if (sub.status === 'past_due') {
          // Grace period: keep access, flag the account. Stripe's retry
          // settings decide when it flips to unpaid/canceled.
          await recordEvent(admin, userId, 'subscription_past_due', event.id, plan)
        } else {
          // canceled / unpaid / incomplete_expired / paused — unless this is
          // a stale event for an old sub while a newer one is live.
          if (!(await hasOtherLiveSubscription(stripe, customerId, sub.id))) {
            await setSubscription(admin, userId, 'expired', null)
          }
          await recordEvent(admin, userId, 'subscription_expired', event.id, plan)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id
        const userId = await resolveUserId(
          admin,
          stripe,
          sub.metadata?.user_id,
          undefined,
          customerId,
        )
        if (!userId) {
          return json(200, { received: true, orphan: true })
        }
        if (!(await hasOtherLiveSubscription(stripe, customerId, sub.id))) {
          await setSubscription(admin, userId, 'expired', null)
        }
        await recordEvent(admin, userId, 'subscription_expired', event.id, null)
        break
      }

      case 'checkout.session.async_payment_failed': {
        // Async method (P24/BLIK/bank transfer) failed after the session
        // completed — access was never granted, so only audit it.
        const session = event.data.object as Stripe.Checkout.Session
        const customerId =
          typeof session.customer === 'string' ? session.customer : session.customer?.id
        const userId = await resolveUserId(
          admin,
          stripe,
          session.metadata?.user_id,
          session.client_reference_id ?? undefined,
          customerId,
        )
        if (userId) {
          await recordEvent(admin, userId, 'payment_failed', event.id, null)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId =
          typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
        const userId = await resolveUserId(
          admin,
          stripe,
          undefined,
          undefined,
          customerId,
        )
        if (userId) {
          await recordEvent(admin, userId, 'subscription_past_due', event.id, null)
        }
        break
      }

      default:
        // Unhandled event types are acknowledged so Stripe stops retrying.
        return json(200, { received: true, ignored: event.type })
    }
  } catch (err) {
    console.error('stripe-webhook: handler failed', event.type, err)
    // 500 → Stripe retries; idempotency makes the retry safe.
    return json(500, { error: 'handler_error' })
  }

  return json(200, { received: true })
})
