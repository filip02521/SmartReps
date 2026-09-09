import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { track, AnalyticsEvents } from '@/lib/analytics'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export function getVapidPublicKey(): string | null {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  return key?.trim() ? key.trim() : null
}

/**
 * Zapisuje VAPID public key w Cache API, aby service worker mógł go odczytać
 * w `pushsubscriptionchange` (SW nie ma dostępu do import.meta.env).
 * Cache API persists across SW restarts i jest dostępne w kontekście SW.
 */
const VAPID_CACHE_NAME = 'sr-vapid'
const VAPID_CACHE_URL = '/__vapid_public_key__'

async function cacheVapidPublicKey(vapid: string): Promise<void> {
  try {
    const cache = await caches.open(VAPID_CACHE_NAME)
    await cache.put(
      new Request(VAPID_CACHE_URL),
      new Response(vapid, {
        headers: { 'Content-Type': 'text/plain' },
      }),
    )
  } catch {
    // Cache API niedostępne — SW nie będzie mógł re-subskrybować,
    // ale główna subskrypcja nadal działa.
  }
}

export async function subscribeWebPush(reminderHour: number): Promise<boolean> {
  if (!isWebPushSupported()) {
    track(AnalyticsEvents.pushSubscribeFail, { reason: 'unsupported' })
    return false
  }
  const vapid = getVapidPublicKey()
  if (!vapid) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY missing')
    track(AnalyticsEvents.pushSubscribeFail, { reason: 'no_vapid' })
    return false
  }
  if (!isSupabaseConfigured) {
    track(AnalyticsEvents.pushSubscribeFail, { reason: 'no_supabase' })
    return false
  }

  // Verify user is logged in BEFORE requesting notification permission —
  // otherwise the user grants permission for nothing if not authenticated.
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) {
    track(AnalyticsEvents.pushSubscribeFail, { reason: 'no_user' })
    return false
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()
  if (permission !== 'granted') {
    track(AnalyticsEvents.pushSubscribeFail, { reason: 'permission_denied' })
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid) as BufferSource,
      })
    }

    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      track(AnalyticsEvents.pushSubscribeFail, { reason: 'bad_keys' })
      return false
    }

    const timezone =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        : 'UTC'

    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        keys: json.keys,
        user_agent: navigator.userAgent.slice(0, 240),
        reminder_hour: reminderHour,
        timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    )
    if (error) {
      console.warn('[push] upsert failed', error)
      track(AnalyticsEvents.pushSubscribeFail, { reason: 'upsert' })
      return false
    }
    track(AnalyticsEvents.pushSubscribeOk)
    await cacheVapidPublicKey(vapid)
    return true
  } catch (err) {
    console.warn('[push] subscribe failed', err)
    track(AnalyticsEvents.pushSubscribeFail, { reason: 'exception' })
    return false
  }
}

export async function unsubscribeWebPush(): Promise<void> {
  if (!isWebPushSupported()) return
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    const endpoint = subscription.endpoint
    await subscription.unsubscribe()
    if (isSupabaseConfigured) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    }
  } catch (err) {
    console.warn('[push] unsubscribe failed', err)
    track(AnalyticsEvents.pushUnsubscribeFail, { reason: 'exception' })
  }
}

export async function updatePushReminderHour(reminderHour: number): Promise<void> {
  // Server cron still gates on next_workout_after (calendar day in this timezone).
  if (!isSupabaseConfigured || !isWebPushSupported()) return
  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.getSubscription()
    if (!subscription) return
    const timezone =
      typeof Intl !== 'undefined'
        ? Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
        : 'UTC'
    await supabase
      .from('push_subscriptions')
      .update({
        reminder_hour: reminderHour,
        timezone,
        updated_at: new Date().toISOString(),
      })
      .eq('endpoint', subscription.endpoint)
  } catch (err) {
    console.warn('[push] reminder hour update failed', err)
    track(AnalyticsEvents.pushReminderUpdateFail, { reason: 'reminder_hour_update' })
  }
}
