import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TextField } from '@/components/ui/TextField'
import { SwitchRow } from '@/components/ui/Switch'
import { Button } from '@/components/ui/Button'
import { InfoHint } from '@/components/ui/InfoHint'
import { AiCoachHeader } from '@/components/brand/AiCoachHeader'
import { pl } from '@/i18n/pl'
import type { UserSettings } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'

type Theme = UserSettings['theme']

const AI_PRESETS = {
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash-lite' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
} as const

/* ── Appearance & language ── */
export function AppearanceSection({
  theme,
  highContrast,
  language,
  onThemeChange,
  onHighContrastChange,
  onLanguageChange,
}: {
  theme: Theme
  highContrast: boolean
  language: 'pl' | 'en'
  onThemeChange: (t: Theme) => void
  onHighContrastChange: (on: boolean) => void
  onLanguageChange: (lang: 'pl' | 'en') => void
}) {
  return (
    <>
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
          {pl.themeLabel}
          <InfoHint text={pl.themeHint} className="ml-1.5" />
        </p>
        <SegmentedControl
          options={[
            { value: 'system' as const, label: pl.themeSystem },
            { value: 'dark' as const, label: pl.themeDark },
            { value: 'light' as const, label: pl.themeLight },
          ]}
          value={theme}
          onChange={onThemeChange}
        />
      </div>
      <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-4">
        <SwitchRow
          id="high-contrast"
          label={
            <>
              {pl.highContrast}
              <InfoHint text={pl.highContrastHint} className="ml-1.5" />
            </>
          }
          checked={highContrast}
          onChange={onHighContrastChange}
        />
      </div>
      <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-4">
        <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
          {pl.languageLabel}
          <InfoHint text={pl.languageHint} className="ml-1.5" />
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
    </>
  )
}

/* ── Training ── */
export function TrainingSection({
  weightUnit,
  timerSound,
  timerVibration,
  keepScreenOn,
  onWeightUnitChange,
  onTimerSoundChange,
  onTimerVibrationChange,
  onKeepScreenOnChange,
}: {
  weightUnit: 'kg' | 'lb'
  timerSound: boolean
  timerVibration: boolean
  keepScreenOn: boolean
  onWeightUnitChange: (unit: 'kg' | 'lb') => void
  onTimerSoundChange: (on: boolean) => void
  onTimerVibrationChange: (on: boolean) => void
  onKeepScreenOnChange: (on: boolean) => void
}) {
  return (
    <>
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
          {pl.weightUnitLabel}
          <InfoHint text={pl.weightUnitHint} className="ml-1.5" />
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
      <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-4">
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
      </div>
    </>
  )
}

/* ── Reminders ── */
export function RemindersSection({
  pushNotifications,
  workoutReminders,
  reminderHour,
  pushDescription,
  remindersDenied,
  pushDisabled,
  localRemindersDisabled,
  showReminderHour,
  onPushChange,
  onLocalRemindersChange,
  onReminderHourChange,
}: {
  pushNotifications: boolean
  workoutReminders: boolean
  reminderHour: number
  pushDescription: string
  remindersDenied: boolean
  pushDisabled: boolean
  localRemindersDisabled: boolean
  showReminderHour: boolean
  onPushChange: (on: boolean) => void
  onLocalRemindersChange: (on: boolean) => void
  onReminderHourChange: (hour: number) => void
}) {
  return (
    <>
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
        <div className="mt-3 flex items-start gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/30 bg-[var(--sr-warning)]/10 p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--sr-warning)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--sr-warning)]">{pl.workoutRemindersDenied}</p>
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">{pl.pushOsSettingsHint}</p>
          </div>
        </div>
      )}
      {showReminderHour && (
        <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-4">
          <p className="text-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.reminderHourLabel}
            <InfoHint text={pl.reminderHourHint} className="ml-1.5" />
          </p>
          <select
            aria-label={pl.reminderHourLabel}
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
        </div>
      )}
    </>
  )
}

/* ── AI Coach ── */
export function AiCoachSection({
  aiApiKey,
  aiModel,
  aiBaseUrl,
  aiProactiveCoach,
  aiReasoningEffort,
  onAiApiKeySave,
  onAiModelSave,
  onAiBaseUrlSave,
  onAiProactiveCoachChange,
  onAiReasoningEffortChange,
}: {
  aiApiKey: string
  aiModel: string
  aiBaseUrl: string
  aiProactiveCoach: boolean
  aiReasoningEffort: 'auto' | 'low' | 'medium' | 'high'
  onAiApiKeySave: (key: string) => void
  onAiModelSave: (model: string) => void
  onAiBaseUrlSave: (url: string) => void
  onAiProactiveCoachChange: (enabled: boolean) => void
  onAiReasoningEffortChange: (effort: 'auto' | 'low' | 'medium' | 'high') => void
}) {
  const [apiKeyDraft, setApiKeyDraft] = useState(aiApiKey)
  const [modelDraft, setModelDraft] = useState(aiModel)
  const [baseUrlDraft, setBaseUrlDraft] = useState(aiBaseUrl)
  const [baseUrlError, setBaseUrlError] = useState('')
  useEffect(() => {
    setApiKeyDraft(aiApiKey)
  }, [aiApiKey])
  useEffect(() => {
    setModelDraft(aiModel)
  }, [aiModel])
  useEffect(() => {
    setBaseUrlDraft(aiBaseUrl)
  }, [aiBaseUrl])

  const connected = apiKeyDraft.trim().length > 0

  function handleSave() {
    const trimmedUrl = baseUrlDraft.trim()
    if (trimmedUrl) {
      try {
        const u = new URL(trimmedUrl)
        if (!u.protocol.startsWith('http')) throw new Error('invalid protocol')
      } catch {
        setBaseUrlError(pl.aiBaseUrlInvalid)
        return
      }
    }
    setBaseUrlError('')
    onAiApiKeySave(apiKeyDraft.trim())
    onAiModelSave(modelDraft.trim() || 'gpt-4o-mini')
    onAiBaseUrlSave(trimmedUrl)
    showToast(pl.aiCoachConfigSaved, 'success')
  }

  const providerHint = (() => {
    const url = baseUrlDraft
    if (!url || url === AI_PRESETS.openai.baseUrl) return pl.aiProviderHintOpenai
    if (url === AI_PRESETS.gemini.baseUrl) return pl.aiProviderHintGemini
    if (url === AI_PRESETS.groq.baseUrl) return pl.aiProviderHintGroq
    return pl.aiProviderHintCustom
  })()

  return (
    <>
      <AiCoachHeader
        size="sm"
        subtitle={pl.aiCoachTagline}
        status={connected ? pl.aiCoachConfigConnected : pl.aiCoachConfigDisconnected}
      />

      {/* Provider — choose OpenAI / Gemini / Groq / custom */}
      <div className="mt-4">
        <p className="sr-text-overline text-[var(--sr-text-muted)]">
          {pl.aiCoachSubsectionProvider}
          <InfoHint text={providerHint} className="ml-1.5" />
        </p>
        <div className="mt-2">
          <SegmentedControl
            stretch
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
        </div>
      </div>

      {/* Connection — API key, model, base URL (only for custom provider) */}
      <div className="mt-5 border-t border-[var(--sr-border-subtle)] pt-4">
        <p className="sr-text-overline text-[var(--sr-text-muted)]">
          {pl.aiCoachSubsectionConnection}
          <InfoHint text={pl.aiCoachConnectionHint} className="ml-1.5" />
        </p>
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
          label={
            <>
              {pl.aiModelLabel}
              <InfoHint text={pl.aiModelHint} className="ml-1.5" />
            </>
          }
          value={modelDraft}
          onChange={(e) => setModelDraft(e.target.value)}
        />
        {/* Base URL only for custom provider — presets fill it automatically */}
        {(!baseUrlDraft ||
          !Object.values(AI_PRESETS).some((p) => p.baseUrl === baseUrlDraft)) && (
          <TextField
            id="ai-base-url"
            className="mt-3"
            label={
              <>
                {pl.aiBaseUrlLabel}
                <InfoHint text={pl.aiBaseUrlHint} className="ml-1.5" />
              </>
            }
            value={baseUrlDraft}
            onChange={(e) => {
              setBaseUrlDraft(e.target.value)
              if (baseUrlError) setBaseUrlError('')
            }}
            placeholder={pl.aiBaseUrlPlaceholder}
            aria-invalid={baseUrlError ? true : undefined}
            hint={baseUrlError || undefined}
            hintClassName={baseUrlError ? 'text-[var(--sr-error)]' : undefined}
          />
        )}
      </div>

      {/* Options — reasoning effort (Gemini only) + proactive coach */}
      {connected && (
        <div className="mt-5 border-t border-[var(--sr-border-subtle)] pt-4">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {pl.aiCoachSubsectionOptions}
          </p>

          {baseUrlDraft.includes('googleapis') && (
            <div className="mt-3">
              <p className="text-sm font-medium text-[var(--sr-text-secondary)]">
                {pl.aiReasoningEffortLabel}
                <InfoHint text={pl.aiReasoningEffortHint} className="ml-1.5" />
              </p>
              <SegmentedControl
                className="mt-2"
                value={aiReasoningEffort}
                onChange={(v) => onAiReasoningEffortChange(v as 'auto' | 'low' | 'medium' | 'high')}
                options={[
                  { value: 'auto', label: pl.aiReasoningEffortAuto },
                  { value: 'low', label: pl.aiReasoningEffortLow },
                  { value: 'medium', label: pl.aiReasoningEffortMedium },
                  { value: 'high', label: pl.aiReasoningEffortHigh },
                ]}
              />
            </div>
          )}

          <SwitchRow
            id="ai-proactive-coach"
            className="mt-4"
            checked={aiProactiveCoach}
            onChange={onAiProactiveCoachChange}
            label={pl.coachSettingsProactive}
            description={pl.coachSettingsProactiveDesc}
          />
        </div>
      )}

      {/* Save */}
      <div className="mt-5">
        <Button
          type="button"
          size="touch"
          fullWidth
          onClick={handleSave}
        >
          {pl.aiCoachConfigSave}
        </Button>
      </div>
    </>
  )
}
