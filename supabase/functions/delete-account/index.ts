// Edge Function: delete-account
// Deploy: supabase functions deploy delete-account
// Auth: user JWT (Authorization: Bearer <access_token>)
// Deletes all user data then removes the auth user via service role.
// Cancels any active Stripe subscription before deletion so the user is
// not charged after account removal.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'npm:stripe@17'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!jwt) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })

  const { data: userData, error: userError } = await userClient.auth.getUser(jwt)
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const userId = userData.user.id
  const admin = createClient(supabaseUrl, serviceKey)

  // ── Cancel any active Stripe subscription before deleting data ──
  // Without this, a deleting user with an active Pro subscription would
  // keep getting charged until the subscription naturally expires.
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
  const { data: profile } = await admin
    .from('profiles')
    .select('stripe_customer_id, subscription_status')
    .eq('id', userId)
    .maybeSingle()
  if (stripeKey && profile?.stripe_customer_id) {
    try {
      const stripe = new Stripe(stripeKey)
      // Cancel active, trialing, AND past_due subscriptions — past_due
      // subs still retry-charging and must be cancelled to stop dunning.
      for (const subStatus of ['active', 'trialing', 'past_due'] as const) {
        const subs = await stripe.subscriptions.list({
          customer: profile.stripe_customer_id,
          status: subStatus,
          limit: 10,
        })
        for (const sub of subs.data) {
          await stripe.subscriptions.cancel(sub.id)
        }
      }
    } catch (err) {
      // Log but don't block deletion — the user wants their account gone.
      console.error('delete-account: stripe cancel failed', err)
    }
  }

  const { data: sessions } = await admin
    .from('workout_sessions')
    .select('id')
    .eq('user_id', userId)
  const sessionIds = (sessions ?? []).map((s) => s.id as string)

  if (sessionIds.length) {
    const { error: setsError } = await admin
      .from('set_results')
      .delete()
      .in('session_id', sessionIds)
    if (setsError) {
      console.error('delete set_results failed', setsError.message)
      return new Response(JSON.stringify({ error: 'delete_failed', table: 'set_results' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  }

  const tables = [
    'body_weight_entries',
    'subscription_events',
    'community_reviews',
    'user_achievements',
    'community_reports',
    'community_likes',
    'community_imports',
    'community_publications',
    'active_custom_workout_state',
    'custom_program_progress',
    'custom_plans',
    'user_exercises',
    'active_workout_state',
    'workout_sessions',
    'program_progress',
    'max_tests',
    'push_subscriptions',
    'profiles',
  ] as const

  for (const table of tables) {
    const column =
      table === 'profiles'
        ? 'id'
        : table === 'community_publications'
          ? 'author_id'
          : table === 'community_reports'
            ? 'reporter_id'
            : 'user_id'
    const { error } = await admin.from(table).delete().eq(column, userId)
    if (error) {
      console.error(`delete ${table} failed`, error.message)
      return new Response(JSON.stringify({ error: 'delete_failed', table }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  }

  const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId)
  if (authDeleteError) {
    console.error('auth.admin.deleteUser failed', authDeleteError.message)
    return new Response(JSON.stringify({ error: 'auth_delete_failed' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
