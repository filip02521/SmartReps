// Edge Function: send-workout-reminders
// Deploy: supabase functions deploy send-workout-reminders --no-verify-jwt
// Secrets (Deno env OR public.push_config via service_role; RLS, no policies):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// Schedule: GitHub Actions hourly / Dashboard cron with Authorization: Bearer <CRON_SECRET>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/** Local hour 0–23 for an IANA timezone at the given instant. */
function localHourInTz(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date)
    const hour = parts.find((p) => p.type === 'hour')?.value
    return hour != null ? Number(hour) : date.getUTCHours()
  } catch {
    return date.getUTCHours()
  }
}

type PushConfig = Record<string, string>

async function loadPushConfig(
  supabase: ReturnType<typeof createClient>,
): Promise<PushConfig> {
  const { data, error } = await supabase.from('push_config').select('key, value')
  if (error || !data) return {}
  const out: PushConfig = {}
  for (const row of data) {
    out[row.key as string] = row.value as string
  }
  return out
}

function cfg(envKey: string, db: PushConfig): string | undefined {
  return Deno.env.get(envKey) || db[envKey] || undefined
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const dbCfg = await loadPushConfig(supabase)
  const cronSecret = cfg('CRON_SECRET', dbCfg)
  if (!cronSecret) {
    return new Response(JSON.stringify({ error: 'CRON_SECRET missing' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const vapidPublic = cfg('VAPID_PUBLIC_KEY', dbCfg)
  const vapidPrivate = cfg('VAPID_PRIVATE_KEY', dbCfg)
  const vapidSubject = cfg('VAPID_SUBJECT', dbCfg) ?? 'mailto:hello@smartreps.app'
  if (!vapidPublic || !vapidPrivate) {
    return new Response(JSON.stringify({ error: 'VAPID secrets missing' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  const now = new Date()

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth, reminder_hour, timezone')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const due = (subs ?? []).filter((sub) => {
    const tz = (sub.timezone as string | null) || 'UTC'
    return localHourInTz(now, tz) === sub.reminder_hour
  })

  let sent = 0
  let failed = 0
  for (const sub of due) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: 'SmartReps',
          body: 'Czas na trening — sprawdź swój plan na dziś.',
        }),
      )
      sent += 1
    } catch (err) {
      failed += 1
      const statusCode = (err as { statusCode?: number })?.statusCode
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }

  return new Response(
    JSON.stringify({
      utcHour: now.getUTCHours(),
      due: due.length,
      sent,
      failed,
      total: subs?.length ?? 0,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  )
})
