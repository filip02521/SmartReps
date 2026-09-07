import { Sheet } from '@/components/ui/Sheet'
import { CollapsibleSection } from '@/components/ui/CollapsibleSection'
import { AccountHero } from './AccountHero'
import { AppearanceSection, TrainingSection, RemindersSection, AiCoachSection } from './ProfilePreferences'
import { ProfileDataSection } from './ProfileDataSection'
import type { UserSettings } from '@/stores/app-store'
import { pl } from '@/i18n/pl'
import {
  User,
  Palette,
  Dumbbell,
  Bell,
  Bot,
  Database,
} from 'lucide-react'

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
      <div className="flex flex-col gap-3 pb-4">
        {/* Konto i synchronizacja — domyślnie otwarte */}
        <CollapsibleSection
          title={pl.profileSettingsGroupAccount}
          icon={User}
          defaultOpen
        >
          <AccountHero
            syncing={syncing}
            online={online}
            showLogout={showLogout}
            onSyncNow={onSyncNow}
            onLogin={onLogin}
            onLogout={onLogout}
          />
        </CollapsibleSection>

        {/* Wygląd i język */}
        <CollapsibleSection
          title={pl.profileSettingsGroupAppearance}
          hint={pl.profileSettingsHintAppearance}
          icon={Palette}
        >
          <AppearanceSection
            theme={settings.theme}
            highContrast={settings.highContrast}
            language={settings.language}
            onThemeChange={onThemeChange}
            onHighContrastChange={onHighContrastChange}
            onLanguageChange={onLanguageChange}
          />
        </CollapsibleSection>

        {/* Trening */}
        <CollapsibleSection
          title={pl.profileSettingsGroupTraining}
          hint={pl.profileSettingsHintTraining}
          icon={Dumbbell}
        >
          <TrainingSection
            weightUnit={settings.weightUnit}
            timerSound={settings.timerSound}
            timerVibration={settings.timerVibration}
            keepScreenOn={settings.keepScreenOn}
            onWeightUnitChange={onWeightUnitChange}
            onTimerSoundChange={onTimerSoundChange}
            onTimerVibrationChange={onTimerVibrationChange}
            onKeepScreenOnChange={onKeepScreenOnChange}
          />
        </CollapsibleSection>

        {/* Przypomnienia */}
        <CollapsibleSection
          title={pl.profileSettingsGroupReminders}
          hint={pl.profileSettingsHintReminders}
          icon={Bell}
        >
          <RemindersSection
            pushNotifications={settings.pushNotifications}
            workoutReminders={settings.workoutReminders}
            reminderHour={settings.reminderHour}
            pushDescription={pushDescription}
            remindersDenied={remindersDenied}
            pushDisabled={pushDisabled}
            localRemindersDisabled={localRemindersDisabled}
            showReminderHour={showReminderHour}
            onPushChange={onPushChange}
            onLocalRemindersChange={onLocalRemindersChange}
            onReminderHourChange={onReminderHourChange}
          />
        </CollapsibleSection>

        {/* Trener AI */}
        <CollapsibleSection
          title={pl.profileSettingsGroupAi}
          hint={pl.profileSettingsHintAi}
          icon={Bot}
        >
          <AiCoachSection
            aiApiKey={settings.aiApiKey ?? ''}
            aiModel={settings.aiModel ?? 'gpt-4o-mini'}
            aiBaseUrl={settings.aiBaseUrl ?? ''}
            aiProactiveCoach={settings.aiProactiveCoach}
            aiReasoningEffort={settings.aiReasoningEffort}
            onAiApiKeySave={onAiApiKeySave}
            onAiModelSave={onAiModelSave}
            onAiBaseUrlSave={onAiBaseUrlSave}
            onAiProactiveCoachChange={onAiProactiveCoachChange}
            onAiReasoningEffortChange={onAiReasoningEffortChange}
          />
        </CollapsibleSection>

        {/* Dane i backup */}
        <CollapsibleSection
          title={pl.profileSettingsGroupData}
          hint={pl.profileSettingsHintData}
          icon={Database}
          tone="danger"
        >
          <ProfileDataSection
            showDeleteAccount={showDeleteAccount}
            onImport={onImport}
            onExportJson={onExportJson}
            onExportCsv={onExportCsv}
            onClearLocal={onClearLocal}
            onDeleteAccount={onDeleteAccount}
          />
        </CollapsibleSection>
      </div>
    </Sheet>
  )
}
