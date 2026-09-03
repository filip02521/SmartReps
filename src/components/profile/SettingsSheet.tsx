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
  onDisplayNameSave: (name: string) => void | Promise<void>
  onWeightUnitChange: (unit: 'kg' | 'lb') => void
  // Data
  showDeleteAccount: boolean
  onImport: () => void
  onExportJson: () => void
  onExportCsv: () => void
  onClearLocal: () => void
  onDeleteAccount: () => void
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
  onDisplayNameSave,
  onWeightUnitChange,
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
      <div className="flex flex-col gap-6 pb-4">
        {/* Account / sync */}
        <AccountHero
          syncing={syncing}
          online={online}
          showLogout={showLogout}
          onSyncNow={onSyncNow}
          onLogin={onLogin}
          onLogout={onLogout}
        />

        {/* Preferences */}
        <ProfilePreferences
          theme={settings.theme}
          highContrast={settings.highContrast}
          timerSound={settings.timerSound}
          timerVibration={settings.timerVibration}
          keepScreenOn={settings.keepScreenOn}
          pushNotifications={settings.pushNotifications}
          workoutReminders={settings.workoutReminders}
          reminderHour={settings.reminderHour}
          displayName={settings.displayName ?? ''}
          weightUnit={settings.weightUnit}
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
          onDisplayNameSave={onDisplayNameSave}
          onWeightUnitChange={onWeightUnitChange}
        />

        {/* Data management */}
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
