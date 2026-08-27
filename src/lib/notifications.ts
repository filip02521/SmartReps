import { pl } from '@/i18n/pl'

let activeReminderId: number | null = null

export async function requestWorkoutReminderPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function showWorkoutReminder(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/brand/logo-mark.svg' })
  } catch {
    // Safari / restricted contexts
  }
}

/**
 * Schedules an in-tab reminder via setTimeout.
 * Limitation: timers are cleared when the PWA/browser tab is killed or the device sleeps
 * for a long time — not a substitute for Web Push / periodic background sync.
 */
export function scheduleDailyReminder(hour = 18, minute = 0): number | null {
  cancelReminder()
  const now = new Date()
  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  const delay = next.getTime() - now.getTime()
  activeReminderId = window.setTimeout(() => {
    showWorkoutReminder(pl.reminderNotificationTitle, pl.reminderNotificationBody)
    scheduleDailyReminder(hour, minute)
  }, delay)
  return activeReminderId
}

export function cancelReminder(timerId?: number | null) {
  const id = timerId ?? activeReminderId
  if (id != null) window.clearTimeout(id)
  if (id === activeReminderId) activeReminderId = null
}
