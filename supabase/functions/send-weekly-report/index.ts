// Edge Function: send-weekly-report
// Deploy: supabase functions deploy send-weekly-report --no-verify-jwt
// Secrets (Deno env OR public.push_config via service_role; RLS, no policies):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// Schedule: GitHub Actions hourly — fires on Sundays at 18:00 local time per user.
//
// Sends a Web Push notification to each subscribed user whose local time is
// Sunday 18:00, prompting them to open the app and view their weekly report.

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

/** Local day-of-week (0=Sunday) for an IANA timezone at the given instant. */
function localDayOfWeekInTz(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
    }).formatToParts(date)
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? ''
    const map: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    }
    return map[weekday] ?? date.getUTCDay()
  } catch {
    return date.getUTCDay()
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

  // Fetch all push subscriptions with user timezone
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('user_id, endpoint, keys, p256dh, auth, timezone')
    .eq('enabled', true)

  if (error || !subs) {
    return new Response(JSON.stringify({ error: error?.message ?? 'no subs' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Filter to users whose local time is Sunday 18:00
  const dueSubs = subs.filter((sub) => {
    const tz = sub.timezone || 'Europe/Warsaw'
    return localDayOfWeekInTz(now, tz) === 0 && localHourInTz(now, tz) === 18
  })

  if (dueSubs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no users at Sunday 18:00 local' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Send push to each due user; cleanup expired subscriptions (404/410)
  let sent = 0
  let failed = 0
  let cleaned = 0

  for (const sub of dueSubs) {
    const payload = JSON.stringify({
      title: 'Trener SmartReps',
      body: 'Twoje podsumowanie tygodnia jest gotowe — sprawdź, jak poszło!',
      url: '/?weekly_report=1',
      tag: 'weekly-report',
    })
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload,
      )
      sent += 1
    } catch (err) {
      failed += 1
      const statusCode = (err as { statusCode?: number })?.statusCode
      // 404/410 = subscription expired or cancelled — remove from db
      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', sub.endpoint)
        cleaned += 1
      }
    }
  }

  return new Response(JSON.stringify({ sent, failed, cleaned, total: dueSubs.length }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
