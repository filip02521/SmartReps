import type { ReactNode } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { AccountHero } from './AccountHero'
import { ProfilePreferences } from './ProfilePreferences'
import { ProfileDataSection } from './ProfileDataSection'
import type { UserSettings } from '@/stores/app-store'
import { pl } from '@/i18n/pl'

type SettingsSheetProps = {
  open: boolean
  onClose: () => void
  // Account
  syncing: boolean
  online: boolean
  showLogout: boolean
  onSyncNow: () => void | Promise<void>
  onLogin: () => void
  onLogout: () => void
  // Preferences
  settings: UserSettings
  pushDescription: string
  remindersDenied: boolean
  pushDisabled: boolean
  localRemindersDisabled: boolean
  showReminderHour: boolean
  onThemeChange: (t: UserSettings['theme']) => void
  onHighContrastChange: (on: boolean) => void
  onTimerSoundChange: (on: boolean) => void
  onTimerVibrationChange: (on: boolean) => void
  onKeepScreenOnChange: (on: boolean) => void
  onPushChange: (on: boolean) => void
  onLocalRemindersChange: (on: boolean) => void
  onReminderHourChange: (hour: number) => void
  onWeightUnitChange: (unit: 'kg' | 'lb') => void
  onLanguageChange: (lang: 'pl' | 'en') => void
  onAiApiKeySave: (key: string) => void
  onAiModelSave: (model: string) => void
  onAiBaseUrlSave: (url: string) => void
  onAiProactiveCoachChange: (enabled: boolean) => void
  onAiReasoningEffortChange: (effort: 'auto' | 'low' | 'medium' | 'high') => void
  // Data
  showDeleteAccount: boolean
  onImport: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onClearLocal: () => void
  onDeleteAccount: () => void
}

/** Group header — visual separator with label, breaks up the long settings scroll. */
function GroupHeader({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <div className="h-px flex-1 bg-[var(--sr-border-subtle)]" />
      <span className="text-xs font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
        {children}
      </span>
      <div className="h-px flex-1 bg-[var(--sr-border-subtle)]" />
    </div>
  )
}

export function SettingsSheet({
  open,
  onClose,
  syncing,
  online,
  showLogout,
  onSyncNow,
  onLogin,
  onLogout,
  settings,
  pushDescription,
  remindersDenied,
  pushDisabled,
  localRemindersDisabled,
  showReminderHour,
  onThemeChange,
  onHighContrastChange,
  onTimerSoundChange,
  onTimerVibrationChange,
  onKeepScreenOnChange,
  onPushChange,
  onLocalRemindersChange,
  onReminderHourChange,
  onWeightUnitChange,
  onLanguageChange,
  onAiApiKeySave,
  onAiModelSave,
  onAiBaseUrlSave,
  onAiProactiveCoachChange,
  onAiReasoningEffortChange,
  showDeleteAccount,
  onImport,
  onExportJson,
  onExportCsv,
  onClearLocal,
  onDeleteAccount,
}: SettingsSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pl.settingsTitle}
    >
      <div className="flex flex-col gap-4 pb-4">
        {/* Group: Account & sync */}
        <GroupHeader>{pl.profileSettingsGroupAccount}</GroupHeader>
        <AccountHero
          syncing={syncing}
          online={online}
          showLogout={showLogout}
          onSyncNow={onSyncNow}
          onLogin={onLogin}
          onLogout={onLogout}
        />

        {/* Group: Preferences (appearance, training, reminders, AI coach) */}
        <GroupHeader>{pl.profileSettingsGroupPreferences}</GroupHeader>
        <ProfilePreferences
          theme={settings.theme}
          highContrast={settings.highContrast}
          timerSound={settings.timerSound}
          timerVibration={settings.timerVibration}
          keepScreenOn={settings.keepScreenOn}
          pushNotifications={settings.pushNotifications}
          workoutReminders={settings.workoutReminders}
          reminderHour={settings.reminderHour}
          weightUnit={settings.weightUnit}
          language={settings.language}
          aiApiKey={settings.aiApiKey ?? ''}
          aiModel={settings.aiModel ?? 'gpt-4o-mini'}
          aiBaseUrl={settings.aiBaseUrl ?? ''}
          aiProactiveCoach={settings.aiProactiveCoach}
          aiReasoningEffort={settings.aiReasoningEffort}
          pushDescription={pushDescription}
          remindersDenied={remindersDenied}
          pushDisabled={pushDisabled}
          localRemindersDisabled={localRemindersDisabled}
          showReminderHour={showReminderHour}
          onThemeChange={onThemeChange}
          onHighContrastChange={onHighContrastChange}
          onTimerSoundChange={onTimerSoundChange}
          onTimerVibrationChange={onTimerVibrationChange}
          onKeepScreenOnChange={onKeepScreenOnChange}
          onPushChange={onPushChange}
          onLocalRemindersChange={onLocalRemindersChange}
          onReminderHourChange={onReminderHourChange}
          onWeightUnitChange={onWeightUnitChange}
          onLanguageChange={onLanguageChange}
          onAiApiKeySave={onAiApiKeySave}
          onAiModelSave={onAiModelSave}
          onAiBaseUrlSave={onAiBaseUrlSave}
          onAiProactiveCoachChange={onAiProactiveCoachChange}
          onAiReasoningEffortChange={onAiReasoningEffortChange}
        />

        {/* Group: Data & backup */}
        <GroupHeader>{pl.profileSettingsGroupData}</GroupHeader>
        <ProfileDataSection
          showDeleteAccount={showDeleteAccount}
          onImport={onImport}
          onExportJson={onExportJson}
          onExportCsv={onExportCsv}
          onClearLocal={onClearLocal}
          onDeleteAccount={onDeleteAccount}
        />
      </div>
    </Sheet>
  )
}
