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

const AI_PRESETS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
} as const

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
  language,
  aiApiKey,
  aiModel,
  aiBaseUrl,
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
  onLanguageChange,
  onAiApiKeySave,
  onAiModelSave,
  onAiBaseUrlSave,
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
  language: 'pl' | 'en'
  aiApiKey: string
  aiModel: string
  aiBaseUrl: string
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
  onLanguageChange: (lang: 'pl' | 'en') => void
  onAiApiKeySave: (key: string) => void
  onAiModelSave: (model: string) => void
  onAiBaseUrlSave: (url: string) => void
}) {
  const [nameDraft, setNameDraft] = useState(displayName)
  const [apiKeyDraft, setApiKeyDraft] = useState(aiApiKey)
  const [modelDraft, setModelDraft] = useState(aiModel)
  const [baseUrlDraft, setBaseUrlDraft] = useState(aiBaseUrl)
  useEffect(() => {
    setNameDraft(displayName)
  }, [displayName])
  useEffect(() => {
    setApiKeyDraft(aiApiKey)
  }, [aiApiKey])
  useEffect(() => {
    setModelDraft(aiModel)
  }, [aiModel])
  useEffect(() => {
    setBaseUrlDraft(aiBaseUrl)
  }, [aiBaseUrl])

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
            {pl.languageLabel}
          </p>
          <SegmentedControl
            options={[
              { value: 'pl' as const, label: pl.languagePl },
              { value: 'en' as const, label: pl.languageEn },
            ]}
            value={language}
            onChange={onLanguageChange}
          />
        </div>
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

      <PageSection title={pl.aiSettingsTitle} hint={pl.aiSettingsHint} className={SECTION}>
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.aiProviderLabel}
          </p>
          <SegmentedControl
            value={(() => {
              if (!baseUrlDraft || baseUrlDraft === AI_PRESETS.openai.baseUrl) return 'openai'
              if (baseUrlDraft === AI_PRESETS.gemini.baseUrl) return 'gemini'
              if (baseUrlDraft === AI_PRESETS.groq.baseUrl) return 'groq'
              return 'custom'
            })()}
            onChange={(v) => {
              const preset = AI_PRESETS[v as keyof typeof AI_PRESETS]
              if (preset) {
                setBaseUrlDraft(preset.baseUrl)
                setModelDraft(preset.model)
              }
            }}
            options={[
              { value: 'openai', label: pl.aiProviderOpenai },
              { value: 'gemini', label: pl.aiProviderGemini },
              { value: 'groq', label: pl.aiProviderGroq },
              { value: 'custom', label: pl.aiProviderCustom },
            ]}
          />
          <p className="mt-2 text-xs text-[var(--sr-text-muted)]">
            {(() => {
              const url = baseUrlDraft
              if (!url || url === AI_PRESETS.openai.baseUrl) return pl.aiProviderHintOpenai
              if (url === AI_PRESETS.gemini.baseUrl) return pl.aiProviderHintGemini
              if (url === AI_PRESETS.groq.baseUrl) return pl.aiProviderHintGroq
              return pl.aiProviderHintCustom
            })()}
          </p>
        </div>

        <TextField
          id="ai-api-key"
          className="mt-3"
          label={pl.aiApiKeyLabel}
          placeholder={pl.aiApiKeyPlaceholder}
          type="password"
          value={apiKeyDraft}
          onChange={(e) => setApiKeyDraft(e.target.value)}
        />
        <TextField
          id="ai-model"
          className="mt-3"
          label={pl.aiModelLabel}
          value={modelDraft}
          onChange={(e) => setModelDraft(e.target.value)}
        />
        <p className="mt-1 text-xs text-[var(--sr-text-muted)]">{pl.aiModelHint}</p>
        <TextField
          id="ai-base-url"
          className="mt-3"
          label={pl.aiBaseUrlLabel}
          value={baseUrlDraft}
          onChange={(e) => setBaseUrlDraft(e.target.value)}
          placeholder="https://api.openai.com/v1"
        />
        <p className="mt-1 text-xs text-[var(--sr-text-muted)]">{pl.aiBaseUrlHint}</p>
        <Button
          type="button"
          className="mt-3"
          size="sm"
          onClick={() => {
            onAiApiKeySave(apiKeyDraft.trim())
            onAiModelSave(modelDraft.trim() || 'gpt-4o-mini')
            onAiBaseUrlSave(baseUrlDraft.trim())
          }}
        >
          {pl.communityDisplayNameSave}
        </Button>
      </PageSection>
    </>
  )
}
