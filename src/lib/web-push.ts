import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'

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

export async function subscribeWebPush(reminderHour: number): Promise<boolean> {
  if (!isWebPushSupported()) {
    track('push_subscribe_fail', { reason: 'unsupported' })
    return false
  }
  const vapid = getVapidPublicKey()
  if (!vapid) {
    console.warn('[push] VITE_VAPID_PUBLIC_KEY missing')
    track('push_subscribe_fail', { reason: 'no_vapid' })
    return false
  }
  if (!isSupabaseConfigured) {
    track('push_subscribe_fail', { reason: 'no_supabase' })
    return false
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission()
  if (permission !== 'granted') {
    track('push_subscribe_fail', { reason: 'permission_denied' })
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
      track('push_subscribe_fail', { reason: 'bad_keys' })
      return false
    }

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) {
      track('push_subscribe_fail', { reason: 'no_user' })
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
        user_agent: navigator.userAgent.slice(0, 240),
        reminder_hour: reminderHour,
        timezone,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,endpoint' },
    )
    if (error) {
      console.warn('[push] upsert failed', error)
      track('push_subscribe_fail', { reason: 'upsert' })
      return false
    }
    track('push_subscribe_ok')
    return true
  } catch (err) {
    console.warn('[push] subscribe failed', err)
    track('push_subscribe_fail', { reason: 'exception' })
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
  }
}

export async function updatePushReminderHour(reminderHour: number): Promise<void> {
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
  }
}
