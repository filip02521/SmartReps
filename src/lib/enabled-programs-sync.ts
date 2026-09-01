import type { Program } from '@/data/plans/types'
import { useAppStore, type UserSettings } from '@/stores/app-store'
import { applyThemeColor } from '@/lib/theme-color'

export function parseEnabledPrograms(raw: string[] | null | undefined): Program[] {
  const valid = (raw ?? []).filter((p): p is Program => p === 'pushups' || p === 'pullups')
  return valid.length ? valid : ['pushups']
}

export type RemoteProfileSettings = {
  enabled_programs: string[] | null
  enabled_programs_updated_at: string | null
  enabled_workouts_json?: string[] | null
  theme_preference?: string | null
  timer_sound?: boolean | null
  timer_vibration?: boolean | null
  keep_screen_on?: boolean | null
  reminder_hour?: number | null
  ui_settings_updated_at?: string | null
}

/**
 * Merge remote profile enabled_programs with local using last-write-wins.
 * Falls back to local when remote columns are absent (pre-migration clients).
 */
export function mergeEnabledProgramsFromProfile(remote: RemoteProfileSettings | null): boolean {
  if (!remote?.enabled_programs?.length || !remote.enabled_programs_updated_at) {
    return false
  }

  const remotePrograms = parseEnabledPrograms(remote.enabled_programs)
  const remoteUpdatedAt = remote.enabled_programs_updated_at
  const { settings, enabledProgramsUpdatedAt } = useAppStore.getState()

  const localTime = enabledProgramsUpdatedAt ? new Date(enabledProgramsUpdatedAt).getTime() : 0
  const remoteTime = new Date(remoteUpdatedAt).getTime()

  if (remoteTime <= localTime) return false

  const same =
    remotePrograms.length === settings.enabledPrograms.length &&
    remotePrograms.every((p) => settings.enabledPrograms.includes(p))

  if (same) {
    useAppStore.setState({ enabledProgramsUpdatedAt: remoteUpdatedAt })
    return false
  }

  useAppStore.setState({
    settings: {
      ...settings,
      enabledPrograms: remotePrograms,
      enabledCustomPlanIds: Array.isArray(remote.enabled_workouts_json)
        ? remote.enabled_workouts_json.filter((id): id is string => typeof id === 'string')
        : settings.enabledCustomPlanIds,
    },
    enabledProgramsUpdatedAt: remoteUpdatedAt,
  })
  return true
}

function parseTheme(raw: string | null | undefined): UserSettings['theme'] | null {
  if (raw === 'system' || raw === 'dark' || raw === 'light') return raw
  return null
}

/** LWW merge for theme + timer prefs from profiles. */
export function mergeUiSettingsFromProfile(remote: RemoteProfileSettings | null): boolean {
  if (!remote?.ui_settings_updated_at) return false

  const { settings, uiSettingsUpdatedAt } = useAppStore.getState()
  const localTime = uiSettingsUpdatedAt ? new Date(uiSettingsUpdatedAt).getTime() : 0
  const remoteTime = new Date(remote.ui_settings_updated_at).getTime()
  if (remoteTime <= localTime) return false

  const theme = parseTheme(remote.theme_preference) ?? settings.theme
  const timerSound = remote.timer_sound ?? settings.timerSound
  const timerVibration = remote.timer_vibration ?? settings.timerVibration
  const keepScreenOn = remote.keep_screen_on ?? settings.keepScreenOn
  const reminderHour =
    typeof remote.reminder_hour === 'number' && remote.reminder_hour >= 0 && remote.reminder_hour <= 23
      ? remote.reminder_hour
      : settings.reminderHour

  const unchanged =
    theme === settings.theme &&
    timerSound === settings.timerSound &&
    timerVibration === settings.timerVibration &&
    keepScreenOn === settings.keepScreenOn &&
    reminderHour === settings.reminderHour

  if (unchanged) {
    useAppStore.setState({ uiSettingsUpdatedAt: remote.ui_settings_updated_at })
    return false
  }

  const next = {
    ...settings,
    theme,
    timerSound,
    timerVibration,
    keepScreenOn,
    reminderHour,
  }
  useAppStore.setState({
    settings: next,
    uiSettingsUpdatedAt: remote.ui_settings_updated_at,
  })

  if (theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', theme)
  }
  applyThemeColor(theme)

  // Keep local reminder sinks in sync with pulled hour/mode
  void import('@/lib/notifications').then(({ scheduleDailyReminder, cancelReminder }) => {
    const { settings: s } = useAppStore.getState()
    if (s.workoutReminders && !s.pushNotifications && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      scheduleDailyReminder(s.reminderHour, 0)
    } else {
      cancelReminder()
    }
  })
  if (useAppStore.getState().settings.pushNotifications) {
    void import('@/lib/web-push').then((m) => m.updatePushReminderHour(reminderHour))
  }

  return true
}

/** Programs with Dexie progress that must stay addressable after sync (legacy fallback). */
export function mergeEnabledProgramsFromProgress(programs: Program[]): boolean {
  const { settings } = useAppStore.getState()
  const enabled = new Set(settings.enabledPrograms)
  let changed = false

  for (const program of programs) {
    if (!enabled.has(program)) {
      enabled.add(program)
      changed = true
    }
  }

  if (changed) {
    useAppStore.setState({
      settings: { ...settings, enabledPrograms: Array.from(enabled) as Program[] },
      enabledProgramsUpdatedAt: new Date().toISOString(),
    })
  }

  return changed
}
