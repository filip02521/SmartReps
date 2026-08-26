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

export function scheduleDailyReminder(hour = 18, minute = 0): number | null {
  const now = new Date()
  const next = new Date()
  next.setHours(hour, minute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  const delay = next.getTime() - now.getTime()
  return window.setTimeout(() => {
    showWorkoutReminder('SmartReps', 'Czas na trening — sprawdź swój plan na dziś.')
    scheduleDailyReminder(hour, minute)
  }, delay)
}

export function cancelReminder(timerId: number | null) {
  if (timerId !== null) window.clearTimeout(timerId)
}
