import { useEffect, useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageSection } from '@/components/ui/PageSection'
import { TextField } from '@/components/ui/TextField'
import { SwitchRow } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import type { UserSettings } from '@/stores/app-store'

const SECTION = 'mt-5'

type Theme = UserSettings['theme']

export function ProfilePreferences({
  theme,
  highContrast,
  timerSound,
  timerVibration,
  keepScreenOn,
  pushNotifications,
  workoutReminders,
  reminderHour,
  displayName,
  weightUnit,
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
}: {
  theme: Theme
  highContrast: boolean
  timerSound: boolean
  timerVibration: boolean
  keepScreenOn: boolean
  pushNotifications: boolean
  workoutReminders: boolean
  reminderHour: number
  displayName: string
  weightUnit: 'kg' | 'lb'
  pushDescription: string
  remindersDenied: boolean
  pushDisabled: boolean
  localRemindersDisabled: boolean
  showReminderHour: boolean
  onThemeChange: (t: Theme) => void
  onHighContrastChange: (on: boolean) => void
  onTimerSoundChange: (on: boolean) => void
  onTimerVibrationChange: (on: boolean) => void
  onKeepScreenOnChange: (on: boolean) => void
  onPushChange: (on: boolean) => void
  onLocalRemindersChange: (on: boolean) => void
  onReminderHourChange: (hour: number) => void
  onDisplayNameSave: (name: string) => void | Promise<void>
  onWeightUnitChange: (unit: 'kg' | 'lb') => void
}) {
  const [nameDraft, setNameDraft] = useState(displayName)
  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])

  return (
    <>
      <PageSection title={pl.communityDisplayName} hint={pl.communityDisplayNameHint} className={SECTION}>
        <TextField
          id="profile-display-name"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value.slice(0, 40))}
        />
        <Button
          type="button"
          className="mt-3"
          size="sm"
          onClick={() => void onDisplayNameSave(nameDraft.trim())}
        >
          {pl.communityDisplayNameSave}
        </Button>
      </PageSection>

      <PageSection title={pl.appearance} className={SECTION}>
        <SegmentedControl
          options={[
            { value: 'system' as const, label: pl.themeSystem },
            { value: 'dark' as const, label: pl.themeDark },
            { value: 'light' as const, label: pl.themeLight },
          ]}
          value={theme}
          onChange={onThemeChange}
        />
        <SwitchRow
          id="high-contrast"
          className="mt-4"
          label={pl.highContrast}
          checked={highContrast}
          onChange={onHighContrastChange}
        />
      </PageSection>

      <PageSection title={pl.trainingSettings} className={SECTION}>
        <div className="mb-3">
          <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.weightUnitLabel}
          </p>
          <SegmentedControl
            options={[
              { value: 'kg' as const, label: pl.weightUnitKg },
              { value: 'lb' as const, label: pl.weightUnitLb },
            ]}
            value={weightUnit}
            onChange={onWeightUnitChange}
          />
        </div>
        <div className="flex flex-col">
          <SwitchRow
            id="timer-sound"
            label={pl.timerSound}
            description={pl.timerSoundHint}
            checked={timerSound}
            onChange={onTimerSoundChange}
          />
          <SwitchRow
            id="timer-vibration"
            label={pl.timerVibration}
            description={pl.timerVibrationHint}
            checked={timerVibration}
            onChange={onTimerVibrationChange}
          />
          <SwitchRow
            id="keep-screen-on"
            label={pl.keepScreenOn}
            description={pl.keepScreenOnHint}
            checked={keepScreenOn}
            onChange={onKeepScreenOnChange}
          />
        </div>
      </PageSection>

      <PageSection title={pl.remindersSection} className={SECTION}>
        <div className="flex flex-col">
          <SwitchRow
            id="push-notifications"
            label={pl.pushNotifications}
            description={pushDescription}
            checked={pushNotifications}
            disabled={pushDisabled}
            onChange={onPushChange}
          />
          <SwitchRow
            id="workout-reminders"
            label={pl.workoutReminders}
            description={pl.workoutRemindersHint}
            checked={workoutReminders && !pushNotifications}
            disabled={localRemindersDisabled}
            onChange={onLocalRemindersChange}
          />
        </div>
        {remindersDenied && (
          <>
            <p className="mt-2 text-xs text-[var(--sr-warning)]">{pl.workoutRemindersDenied}</p>
            <p className="mt-1 text-xs text-[var(--sr-warning)]">{pl.pushOsSettingsHint}</p>
          </>
        )}
        {showReminderHour && (
          <label className="mt-4 block text-sm">
            <span className="font-medium">{pl.reminderHourLabel}</span>
            <select
              className="mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-3 text-base text-[var(--sr-text-primary)]"
              value={reminderHour}
              onChange={(e) => onReminderHourChange(Number(e.target.value))}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {pl.reminderHourOption(h)}
                </option>
              ))}
            </select>
          </label>
        )}
      </PageSection>
    </>
  )
}
