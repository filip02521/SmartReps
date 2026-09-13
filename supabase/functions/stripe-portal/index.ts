// Edge Function: stripe-portal
// Deploy: supabase functions deploy stripe-portal
//   (verify_jwt ENABLED — requires the caller's user JWT, same as
//   stripe-checkout.)
// Auth: user JWT (Authorization: Bearer <access_token>)
// Secrets: STRIPE_SECRET_KEY, APP_BASE_URL
//
// Creates a Stripe Customer Portal session for the authenticated user so
// they can manage/cancel their subscription or update payment methods.
// Returns 404 no_customer until the webhook has stored stripe_customer_id
// (i.e. until the user has completed at least one checkout).

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
    return json(503, { error: 'billing_not_configured' })
  }

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

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', userId)
    .maybeSingle()

  const customerId = profile?.stripe_customer_id as string | null | undefined
  if (!customerId) {
    return json(404, { error: 'no_customer' })
  }

  const stripe = new Stripe(stripeKey)
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appBaseUrl}/pro`,
    })
    return json(200, { url: session.url })
  } catch (err) {
    console.error('stripe-portal: portal create failed', err)
    return json(502, { error: 'stripe_error' })
  }
})
