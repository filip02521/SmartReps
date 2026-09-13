// Edge Function: send-weekly-report
// Deploy: supabase functions deploy send-weekly-report --no-verify-jwt
// Secrets (Deno env OR public.push_config via service_role; RLS, no policies):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
//   AI_API_KEY, AI_BASE_URL, AI_MODEL / AI_MODEL_PRO — for server-side report
//   generation (same provider config as ai-proxy).
// Schedule: GitHub Actions hourly — fires on Sundays at 18:00 local time per user.
//
// Pro-only pipeline: for each due Pro user, ensure a weekly_report insight
// exists in ai_insights (generate via AI if missing — the report is ready
// when the user opens the app and syncs down through the normal cloud pull),
// then push a notification whose body is the report's headline.
// Free users are filtered out server-side (Web Push is Pro).

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

/** Week key matching client getWeekKey: local Monday date YYYY-MM-DD. */
function weekKeyInTz(now: Date, timeZone: string): string {
  const ymd = localDateInTz(now, timeZone)
  const [y, m, d] = ymd.split('-').map(Number)
  const probe = new Date(Date.UTC(y, m - 1, d))
  // dow of the calendar date itself — UTC-midnight instant read back in a
  // negative-offset tz would resolve to the previous local day.
  const dow = probe.getUTCDay() // 0=Sun
  const toMonday = dow === 0 ? -6 : 1 - dow
  const monday = new Date(probe.getTime() + toMonday * 86400000)
  const mm = String(monday.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(monday.getUTCDate()).padStart(2, '0')
  return `${monday.getUTCFullYear()}-${mm}-${dd}`
}

/** UTC instant of local Monday 00:00 in the given timezone. */
function weekStartInTz(now: Date, timeZone: string): Date {
  const wk = weekKeyInTz(now, timeZone)
  const [y, m, d] = wk.split('-').map(Number)
  const utcMidnight = new Date(Date.UTC(y, m - 1, d))
  // Probe ±14h in 15-min steps for the instant that reads as Monday 00:00 in
  // the tz — coarser steps miss half/quarter-hour offsets (+5:30, +5:45).
  for (let m15 = -56; m15 <= 56; m15++) {
    const p = new Date(utcMidnight.getTime() + m15 * 15 * 60000)
    if (localDateInTz(p, timeZone) === wk && localHourInTz(p, timeZone) === 0) {
      return p
    }
  }
  return utcMidnight
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

type SessionRow = {
  program: string
  custom_plan_id: string | null
  total_reps: number | null
  exercise_logs_json: unknown
  started_at: string
}

/** Total reps for a session row — builtin uses total_reps; custom sums exercise logs.
 *  exercise_logs_json stores raw ExerciseLog[] — reps live at set.actual.reps
 *  (set.reps only exists in older flattened payloads, kept as fallback). */
function sessionReps(s: SessionRow): number {
  if (s.program !== 'custom') return s.total_reps ?? 0
  const logs = Array.isArray(s.exercise_logs_json) ? s.exercise_logs_json : []
  let total = 0
  for (const log of logs as {
    sets?: { reps?: number; actual?: { reps?: number } }[]
  }[]) {
    for (const set of log.sets ?? []) total += set.actual?.reps ?? set.reps ?? 0
  }
  return total
}

type ReportPayload = {
  summary?: string
  strengths?: string[]
  improvements?: string[]
  recommendation?: string
}

// Polish-first: the report prompt is intentionally PL (matches existing
// PROGRAM_LABELS/push copy convention — Edge Functions can't use frontend i18n).
const REPORT_SYSTEM_PROMPT = `Jesteś trenerem personalnym SmartReps. Na podstawie statystyk tygodnia użytkownika napisz krótki, konkretny raport treningowy po polsku. Odpowiedz WYŁĄCZNIE poprawnym JSON-em:
{"summary":"1-2 zdania oceny tygodnia","strengths":["mocna strona 1","mocna strona 2"],"improvements":["obszar do poprawy"],"recommendation":"konkretna rekomendacja na kolejny tydzień"}
Bądź bezpośredni i motywujący, jak prawdziwy trener. Nie używaj ogólników — odwołuj się do liczb.`

async function generateWeeklyReport(
  supabase: ReturnType<typeof createClient>,
  dbCfg: PushConfig,
  userId: string,
  now: Date,
  timeZone: string,
): Promise<string | null> {
  const apiKey = cfg('AI_API_KEY', dbCfg)
  if (!apiKey) return null
  const baseUrl = (cfg('AI_BASE_URL', dbCfg) ?? 'https://api.openai.com/v1').replace(/\/+$/, '')
  const model = cfg('AI_MODEL_PRO', dbCfg) ?? cfg('AI_MODEL', dbCfg) ?? 'gpt-4o-mini'

  const weekKey = weekKeyInTz(now, timeZone)
  const weekStart = weekStartInTz(now, timeZone)
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000)

  // Skip if a report for this week already exists (client-generated or re-run).
  const { data: existing } = await supabase
    .from('ai_insights')
    .select('id, body')
    .eq('user_id', userId)
    .eq('type', 'weekly_report')
    .eq('week_key', weekKey)
    .limit(1)
  if (existing && existing.length > 0) {
    // Report exists — return its first line for the push snippet.
    return (existing[0].body as string).split('\n')[0].slice(0, 120)
  }

  const { data: sessions } = await supabase
    .from('workout_sessions')
    .select('program, custom_plan_id, total_reps, exercise_logs_json, started_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', weekStart.toISOString())
    .lt('started_at', weekEnd.toISOString())

  const weekSessions = (sessions ?? []) as SessionRow[]
  // Nothing to report — don't burn AI tokens on an empty week.
  if (weekSessions.length === 0) return null

  // Previous 8 weeks in one query — feeds repsWeekChangePct + streakWeeks so
  // the client card renders the same rich metrics as a local report.
  const historyStart = new Date(weekStart.getTime() - 8 * 7 * 86400000)
  const { data: prevSessions } = await supabase
    .from('workout_sessions')
    .select('program, custom_plan_id, total_reps, exercise_logs_json, started_at')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .gte('started_at', historyStart.toISOString())
    .lt('started_at', weekStart.toISOString())

  const totalReps = weekSessions.reduce((sum, s) => sum + sessionReps(s), 0)
  const trainingDays = new Set(
    weekSessions.map((s) => localDateInTz(new Date(s.started_at), timeZone)),
  ).size

  // Mon-first rep buckets for the card's activity chart.
  const dailyReps = [0, 0, 0, 0, 0, 0, 0]
  for (const s of weekSessions) {
    const dow = localDayOfWeekInTz(new Date(s.started_at), timeZone)
    dailyReps[(dow + 6) % 7] = (dailyReps[(dow + 6) % 7] ?? 0) + sessionReps(s)
  }

  // Previous-week reps → week-over-week change; consecutive active weeks → streak.
  let prevWeekReps = 0
  const activeWeekKeys = new Set<string>()
  for (const s of (prevSessions ?? []) as SessionRow[]) {
    const d = new Date(s.started_at)
    activeWeekKeys.add(weekKeyInTz(d, timeZone))
    if (d >= new Date(weekStart.getTime() - 7 * 86400000)) {
      prevWeekReps += sessionReps(s)
    }
  }
  const repsWeekChangePct =
    prevWeekReps > 0 ? ((totalReps - prevWeekReps) / prevWeekReps) * 100 : null
  let streakWeeks = 1 // current week has sessions (checked above)
  for (let i = 1; i <= 8; i++) {
    const wkDate = new Date(weekStart.getTime() - i * 7 * 86400000)
    if (activeWeekKeys.has(weekKeyInTz(wkDate, timeZone))) streakWeeks += 1
    else break
  }
  const perProgram = new Map<string, { sessions: number; reps: number }>()
  for (const s of weekSessions) {
    const key = s.program === 'custom' ? `custom:${s.custom_plan_id ?? ''}` : s.program
    const e = perProgram.get(key) ?? { sessions: 0, reps: 0 }
    e.sessions++
    e.reps += sessionReps(s)
    perProgram.set(key, e)
  }

  const userPrompt = JSON.stringify({
    week: weekKey,
    sessions: weekSessions.length,
    totalReps,
    trainingDays,
    programs: [...perProgram.entries()].map(([k, v]) => ({ program: k, ...v })),
  })

  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: REPORT_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 1200,
      }),
    })
    if (!resp.ok) {
      console.error('weekly-report AI call failed', resp.status)
      return null
    }
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content as string | undefined
    if (!content) return null
    const parsed = JSON.parse(content) as ReportPayload
    if (!parsed.summary) return null

    const body = [
      parsed.summary,
      parsed.strengths?.length ? `\n\n✓ ${parsed.strengths.join('; ')}` : '',
      parsed.improvements?.length ? `\n\n→ ${parsed.improvements.join('; ')}` : '',
      parsed.recommendation ? `\n\n💡 ${parsed.recommendation}` : '',
    ].join('')

    const { error: insertError } = await supabase.from('ai_insights').insert({
      user_id: userId,
      type: 'weekly_report',
      week_key: weekKey,
      title: 'Raport tygodnia',
      body,
      tone: 'insight',
      source: 'ai',
      metrics_json: JSON.stringify({
        sessions: weekSessions.length,
        totalReps,
        trainingDays,
        dailyReps,
        streakWeeks,
        repsWeekChangePct,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString(),
        server: true,
      }),
    })
    if (insertError) {
      console.error('weekly-report insert failed', insertError.message)
      return null
    }
    return parsed.summary.slice(0, 120)
  } catch (err) {
    console.error('weekly-report generation failed', err)
    return null
  }
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
  let dueSubs = subs.filter((sub) => {
    const tz = sub.timezone || 'Europe/Warsaw'
    return localDayOfWeekInTz(now, tz) === 0 && localHourInTz(now, tz) === 18
  })

  // Web Push is a Pro feature — a lapsed Pro user must stop receiving the
  // weekly report push. Filter to currently-Pro accounts; keep their
  // push_subscriptions row so re-upgrade resumes delivery automatically.
  if (dueSubs.length > 0) {
    const dueUserIds = [...new Set(dueSubs.map((s) => s.user_id as string))]
    const { data: proProfiles } = await supabase
      .from('profiles')
      .select('id, subscription_status, subscription_expires_at')
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
    }
    dueSubs = dueSubs.filter((s) => proUserIds.has(s.user_id as string))
  }

  if (dueSubs.length === 0) {
    return new Response(JSON.stringify({ sent: 0, reason: 'no users at Sunday 18:00 local' }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Generate report + send push per user; cleanup expired subscriptions (404/410)
  let sent = 0
  let failed = 0
  let cleaned = 0
  let reports = 0

  for (const sub of dueSubs) {
    const tz = sub.timezone || 'Europe/Warsaw'
    const userId = sub.user_id as string

    // Ensure the weekly report exists (server-side AI generation) and grab
    // its headline for the push body.
    const headline = await generateWeeklyReport(supabase, dbCfg, userId, now, tz)
    if (headline) reports += 1

    const payload = JSON.stringify({
      title: 'Trener SmartReps',
      body: headline
        ? `${headline}${headline.length >= 120 ? '…' : ''}`
        : 'Twoje podsumowanie tygodnia jest gotowe — sprawdź, jak poszło!',
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

  return new Response(JSON.stringify({ sent, failed, cleaned, reports, total: dueSubs.length }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
