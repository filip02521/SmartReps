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

const PROGRAM_LABELS: Record<string, Record<string, string>> = {
  pl: { pushups: 'Pompki', pullups: 'Podciąganie', squats: 'Przysiady' },
  en: { pushups: 'Pushups', pullups: 'Pull-ups', squats: 'Squats' },
}

const PUSH_COPY: Record<string, { body: (day: number) => string }> = {
  pl: { body: (day) => `Dzień ${day} jest dostępny — czas trenować.` },
  en: { body: (day) => `Day ${day} is available — time to train.` },
}

/** Per-user UI language (profiles.language), filled for due users. */
const userLang = new Map<string, 'pl' | 'en'>()
function langFor(userId: string): 'pl' | 'en' {
  return userLang.get(userId) ?? 'pl'
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

/** Local calendar date YYYY-MM-DD in user timezone. */
function localDateInTz(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  } catch {
    return date.toISOString().slice(0, 10)
  }
}

/** Milliseconds to add to UTC instant so local parts match wall time in `timeZone`. */
function timezoneOffsetMs(at: Date, timeZone: string): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    const parts = Object.fromEntries(
      dtf.formatToParts(at).filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
    )
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    return asUtc - at.getTime()
  } catch {
    return 0
  }
}

/** Start of the user's local calendar day as a UTC instant. */
function localDayStartInTz(now: Date, timeZone: string): Date {
  const ymd = localDateInTz(now, timeZone)
  const [y, mo, d] = ymd.split('-').map(Number)
  const utcMidnight = Date.UTC(y, mo - 1, d, 0, 0, 0, 0)
  let start = new Date(utcMidnight - timezoneOffsetMs(new Date(utcMidnight), timeZone))
  if (localDateInTz(start, timeZone) !== ymd || localHourInTz(start, timeZone) !== 0) {
    for (let h = -14; h <= 14; h++) {
      const probe = new Date(utcMidnight + h * 3600000)
      if (localDateInTz(probe, timeZone) === ymd && localHourInTz(probe, timeZone) === 0) {
        start = probe
        break
      }
    }
  }
  return start
}

/** Exclusive end of the user's local calendar day (start of next local day). */
function localDayEndInTz(now: Date, timeZone: string): Date {
  const dayStart = localDayStartInTz(now, timeZone)
  const probe = new Date(dayStart.getTime() + 36 * 3600000)
  return localDayStartInTz(probe, timeZone)
}

type PushConfig = Record<string, string>

type ProgramProgressRow = {
  program: string
  current_day: number
  status: string
  next_workout_after: string | null
}

type CustomProgressRow = {
  custom_plan_id: string
  current_day: number
  status: string
  next_workout_after: string | null
}

type CustomPlanRow = {
  id: string
  name: string
  status: string
}

type DueWorkout =
  | {
      kind: 'builtin'
      program: string
      currentDay: number
      status: string
      nextWorkoutAfter: string | null
    }
  | {
      kind: 'custom'
      customPlanId: string
      planName: string
      currentDay: number
      status: string
      nextWorkoutAfter: string | null
    }

/**
 * Align with client `isWorkoutAvailable`: due when local calendar day
 * (user timezone) is on/after the local calendar day of next_workout_after.
 * Fire time remains reminder_hour — this only gates the day.
 */
function isWorkoutDue(
  status: string,
  nextWorkoutAfter: string | null,
  now: Date,
  timeZone: string,
): boolean {
  if (status === 'paused' || status === 'cycle_failed' || status === 'test_pending') {
    return false
  }
  if (status === 'cycle_complete') return false
  if (status !== 'active' && status !== 'rest') return false
  if (!nextWorkoutAfter) return true
  const todayYmd = localDateInTz(now, timeZone)
  const dueYmd = localDateInTz(new Date(nextWorkoutAfter), timeZone)
  return todayYmd >= dueYmd
}

function pickDueWorkout(
  candidates: DueWorkout[],
  now: Date,
  timeZone: string,
): DueWorkout | null {
  const due = candidates.filter((c) =>
    isWorkoutDue(c.status, c.nextWorkoutAfter, now, timeZone),
  )
  if (!due.length) return null
  due.sort((a, b) => {
    if (!a.nextWorkoutAfter && !b.nextWorkoutAfter) return 0
    if (!a.nextWorkoutAfter) return -1
    if (!b.nextWorkoutAfter) return 1
    return new Date(a.nextWorkoutAfter).getTime() - new Date(b.nextWorkoutAfter).getTime()
  })
  return due[0] ?? null
}

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

  // Hourly sweep: flip lapsed 'pro'/'trial' rows to 'expired' so the
  // stored status tells the truth and subscription_events gets an audit
  // row. Non-fatal — every pro gate already enforces expires_at, so a
  // missed tick only delays the cosmetic flip.
  const { data: expiredCount, error: sweepErr } = await supabase.rpc(
    'expire_lapsed_subscriptions',
  )
  if (sweepErr) {
    console.error('expire_lapsed_subscriptions failed:', sweepErr)
  } else if (typeof expiredCount === 'number' && expiredCount > 0) {
    console.log(`expired ${expiredCount} lapsed subscription(s)`)
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth, reminder_hour, timezone, last_push_date')

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let due = (subs ?? []).filter((sub) => {
    const tz = (sub.timezone as string | null) || 'UTC'
    return localHourInTz(now, tz) === sub.reminder_hour
  })

  let sent = 0
  let failed = 0
  let skipped = 0

  // Web Push is a Pro feature — the client gates subscribing, but without a
  // server-side check a lapsed Pro user would keep receiving reminders
  // forever. Filter to currently-Pro accounts; keep their push_subscriptions
  // row so re-upgrade resumes delivery without re-subscribing.
  if (due.length > 0) {
    const dueUserIds = [...new Set(due.map((s) => s.user_id as string))]
    const { data: proProfiles } = await supabase
      .from('profiles')
      .select('id, subscription_status, subscription_expires_at, language')
      .in('id', dueUserIds)

    const proUserIds = new Set<string>()
    for (const p of proProfiles ?? []) {
      const st = p.subscription_status as string | null
      const exp = p.subscription_expires_at as string | null
      if (
        st === 'lifetime' ||
        ((st === 'pro' || st === 'trial') && (!exp || new Date(exp) > now))
      ) {
        proUserIds.add(p.id as string)
      }
      userLang.set(p.id as string, (p.language as string | null) === 'en' ? 'en' : 'pl')
    }
    const before = due.length
    due = due.filter((s) => proUserIds.has(s.user_id as string))
    skipped += before - due.length
  }

  for (const sub of due) {
    const tz = (sub.timezone as string | null) || 'UTC'
    const todayLocal = localDateInTz(now, tz)

    if (sub.last_push_date === todayLocal) {
      skipped += 1
      continue
    }

    const userId = sub.user_id as string

    const { data: progressRows } = await supabase
      .from('program_progress')
      .select('program, current_day, status, next_workout_after')
      .eq('user_id', userId)

    const { data: customProgressRows } = await supabase
      .from('custom_program_progress')
      .select('custom_plan_id, current_day, status, next_workout_after')
      .eq('user_id', userId)

    const customProgress = (customProgressRows ?? []) as CustomProgressRow[]
    const customPlanIds = customProgress.map((r) => r.custom_plan_id)
    const planNames = new Map<string, string>()

    if (customPlanIds.length > 0) {
      const { data: planRows } = await supabase
        .from('custom_plans')
        .select('id, name, status')
        .eq('user_id', userId)
        .in('id', customPlanIds)

      for (const row of (planRows ?? []) as CustomPlanRow[]) {
        if (row.status === 'active') {
          planNames.set(row.id, row.name.trim() || 'Własny plan')
        }
      }
    }

    const progress = (progressRows ?? []) as ProgramProgressRow[]
    const candidates: DueWorkout[] = [
      ...progress.map((row) => ({
        kind: 'builtin' as const,
        program: row.program,
        currentDay: row.current_day,
        status: row.status,
        nextWorkoutAfter: row.next_workout_after,
      })),
      ...customProgress
        .filter((row) => planNames.has(row.custom_plan_id))
        .map((row) => ({
          kind: 'custom' as const,
          customPlanId: row.custom_plan_id,
          planName: planNames.get(row.custom_plan_id)!,
          currentDay: row.current_day,
          status: row.status,
          nextWorkoutAfter: row.next_workout_after,
        })),
    ]

    const chosen = pickDueWorkout(candidates, now, tz)

    // Only remind when a workout is due (next_workout_after calendar day + status).
    if (!chosen) {
      skipped += 1
      continue
    }

    const dayStart = localDayStartInTz(now, tz)
    const dayEnd = localDayEndInTz(now, tz)
    let todaySessionsQuery = supabase
      .from('workout_sessions')
      .select('id, passed, status, started_at')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('started_at', dayStart.toISOString())
      .lt('started_at', dayEnd.toISOString())

    if (chosen.kind === 'builtin') {
      todaySessionsQuery = todaySessionsQuery.eq('program', chosen.program)
    } else {
      todaySessionsQuery = todaySessionsQuery
        .eq('program', 'custom')
        .eq('custom_plan_id', chosen.customPlanId)
    }

    const { data: todaySessions } = await todaySessionsQuery

    const alreadyTrained = (todaySessions ?? []).some((s) => s.passed === true)
    if (alreadyTrained) {
      skipped += 1
      continue
    }

    let title: string
    let body: string
    let url: string
    let program: string | null = null

    const lang = langFor(userId)
    if (chosen.kind === 'builtin') {
      const label = PROGRAM_LABELS[lang][chosen.program] ?? chosen.program
      title = `SmartReps — ${label}`
      body = PUSH_COPY[lang].body(chosen.currentDay)
      url = `/?program=${chosen.program}`
      program = chosen.program
    } else {
      title = `SmartReps — ${chosen.planName}`
      body = PUSH_COPY[lang].body(chosen.currentDay)
      url = `/workout/custom/${chosen.customPlanId}`
      program = 'custom'
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({ title, body, url, program }),
      )
      await supabase
        .from('push_subscriptions')
        .update({ last_push_date: todayLocal, updated_at: now.toISOString() })
        .eq('id', sub.id)
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
      skipped,
      total: subs?.length ?? 0,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } },
  )
})
