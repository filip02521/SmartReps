// Edge Function: delete-account
// Deploy: supabase functions deploy delete-account
// Auth: user JWT (Authorization: Bearer <access_token>)
// Deletes all user data then removes the auth user via service role.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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
