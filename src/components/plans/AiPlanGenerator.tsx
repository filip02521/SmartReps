import { useState, useRef } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { FeedbackBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { listExercises } from '@/lib/custom-plan-service'
import { generatePlan, commitGeneratedPlan, type PlanGenerationResult } from '@/lib/ai/plan-generator'
import { AiApiError } from '@/lib/ai/ai-client'
import type { PlanGenerationInput } from '@/lib/ai/prompts'
import type { MetricTarget, SetPrescription } from '@/lib/exercise-model'
import { AiCoachHeader, AiCoachMessage } from '@/components/brand/AiCoachHeader'
import { Check, AlertTriangle, RotateCcw, Sparkles } from 'lucide-react'

type Step = 'form' | 'generating' | 'result' | 'error'

/** Format a MetricTarget for display in the preview. */
function formatTarget(t: MetricTarget | undefined): string {
  if (!t) return ''
  if (t.kind === 'max') return `${t.minValue}+`
  if (t.kind === 'min') return `${t.value}+`
  if (t.kind === 'exact') return `${t.value}`
  return `${t.value}`
}

/** Format a set prescription for the preview. */
function formatSet(set: SetPrescription): string {
  const parts: string[] = []
  if (set.reps) parts.push(`${formatTarget(set.reps)} powt`)
  if (set.durationSec) parts.push(`${formatTarget(set.durationSec)} s`)
  if (set.weightKg) parts.push(`${formatTarget(set.weightKg)} kg`)
  return parts.join(' · ') || '—'
}

export function AiPlanGenerator({
  open,
  onClose,
  onGenerated,
}: {
  open: boolean
  onClose: () => void
  onGenerated: () => void
}) {
  const { settings } = useAppStore()
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')
  const [result, setResult] = useState<PlanGenerationResult | null>(null)
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map())
  const [importing, setImporting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Form state
  const [description, setDescription] = useState('')
  const [daysPerWeek, setDaysPerWeek] = useState(3)
  const [experience, setExperience] = useState<PlanGenerationInput['experienceLevel']>('intermediate')
  const [equipment, setEquipment] = useState<PlanGenerationInput['equipment']>('dumbbells')
  const [goal, setGoal] = useState<PlanGenerationInput['goal']>('hypertrophy')
  const [durationMin, setDurationMin] = useState('')

  const apiKey = settings.aiApiKey ?? ''
  const model = settings.aiModel ?? 'gpt-4o-mini'
  const baseURL = settings.aiBaseUrl ?? ''

  function handleGenerate() {
    if (!apiKey) {
      setError(pl.aiCoachNoApiKey)
      setStep('error')
      return
    }
    if (!description.trim()) {
      setError(pl.aiDescriptionPlaceholder)
      setStep('error')
      return
    }

    // Validate duration if provided
    const durNum = durationMin ? Number(durationMin) : undefined
    if (durNum !== undefined && (!Number.isFinite(durNum) || durNum < 10 || durNum > 300)) {
      setError(pl.aiDurationInvalid)
      setStep('error')
      return
    }

    setStep('generating')
    setError('')

    // Cancel any previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    void (async () => {
      try {
        const library = await listExercises()
        if (controller.signal.aborted) return
        const input: PlanGenerationInput = {
          description: description.trim(),
          daysPerWeek,
          experienceLevel: experience,
          equipment,
          goal,
          sessionDurationMin: durNum,
        }
        const res = await generatePlan(input, { apiKey, model, library, baseURL: baseURL || undefined, signal: controller.signal })
        if (controller.signal.aborted) return
        // Build exercise name lookup for preview
        const names = new Map<string, string>()
        for (const ex of library) names.set(ex.id, ex.name)
        for (const newEx of res.newExercises) names.set(newEx.id, newEx.name)
        setExerciseNames(names)
        setResult(res)
        setStep('result')
      } catch (e) {
        if (controller.signal.aborted) return
        if (e instanceof AiApiError) {
          setError(
            e.kind === 'offline'
              ? pl.aiErrorOffline
              : e.kind === 'auth'
                ? pl.aiErrorAuth
                : e.kind === 'rate_limit'
                  ? pl.aiErrorRateLimit
                  : e.message,
          )
        } else {
          console.error('[AI Plan Generator] Unexpected error:', e)
          setError(
            e instanceof Error
              ? `${pl.aiErrorGeneric} (${e.message})`
              : pl.aiErrorGeneric,
          )
        }
        setStep('error')
      }
    })()
  }

  function handleImport() {
    if (!result) return
    setImporting(true)
    void (async () => {
      try {
        await commitGeneratedPlan(result)
        showToast(pl.aiImported, 'success')
        onGenerated()
        handleClose()
      } catch (e) {
        showToast(e instanceof Error ? e.message : pl.aiErrorGeneric, 'error')
      } finally {
        setImporting(false)
      }
    })()
  }

  function handleClose() {
    abortRef.current?.abort()
    setStep('form')
    setError('')
    setResult(null)
    setExerciseNames(new Map())
    setImporting(false)
    setDescription('')
    setDurationMin('')
    onClose()
  }

  // Back from error → clear error and return to form
  function handleBackToForm() {
    setError('')
    setStep('form')
  }

  // Back from result → confirm discard
  function handleDiscardResult() {
    setStep('form')
    setResult(null)
    setExerciseNames(new Map())
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title={pl.aiCoachName}
    >
      {/* Coach header — persistent across all steps */}
      <AiCoachHeader
        size="sm"
        subtitle={pl.aiCoachTagline}
        status={
          step === 'generating'
            ? pl.aiCoachGenerating
            : step === 'result'
              ? pl.aiCoachPlanReady
              : step === 'error'
                ? pl.aiCoachErrorRetry
                : pl.aiCoachReady
        }
        pulse={step === 'generating'}
      />

      {/* FORM STEP — coach greets, then asks for details */}
      {step === 'form' && (
        <div className="mt-3 flex flex-col gap-4">
          <AiCoachMessage tone="insight">
            {pl.aiCoachGreetingPlan}
          </AiCoachMessage>

          <TextField
            id="ai-description"
            label={pl.aiDescriptionLabel}
            placeholder={pl.aiDescriptionPlaceholder}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.aiDaysLabel}
            </p>
            <SegmentedControl
              value={String(daysPerWeek)}
              onChange={(v) => setDaysPerWeek(Number(v))}
              options={[
                { value: '2', label: '2' },
                { value: '3', label: '3' },
                { value: '4', label: '4' },
                { value: '5', label: '5' },
                { value: '6', label: '6' },
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.aiExperienceLabel}
            </p>
            <SegmentedControl
              value={experience}
              onChange={(v) => setExperience(v as PlanGenerationInput['experienceLevel'])}
              options={[
                { value: 'beginner', label: pl.aiExperienceBeginner },
                { value: 'intermediate', label: pl.aiExperienceIntermediate },
                { value: 'advanced', label: pl.aiExperienceAdvanced },
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.aiEquipmentLabel}
            </p>
            <SegmentedControl
              value={equipment}
              onChange={(v) => setEquipment(v as PlanGenerationInput['equipment'])}
              options={[
                { value: 'bodyweight', label: pl.aiEquipmentBodyweight },
                { value: 'dumbbells', label: pl.aiEquipmentDumbbells },
                { value: 'barbell', label: pl.aiEquipmentBarbell },
                { value: 'full_gym', label: pl.aiEquipmentFullGym },
                { value: 'kettlebell', label: pl.aiEquipmentKettlebell },
              ]}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.aiGoalLabel}
            </p>
            <SegmentedControl
              value={goal}
              onChange={(v) => setGoal(v as PlanGenerationInput['goal'])}
              options={[
                { value: 'hypertrophy', label: pl.aiGoalHypertrophy },
                { value: 'strength', label: pl.aiGoalStrength },
                { value: 'endurance', label: pl.aiGoalEndurance },
                { value: 'general_fitness', label: pl.aiGoalGeneral },
                { value: 'fat_loss', label: pl.aiGoalFatLoss },
              ]}
            />
          </div>

          <TextField
            id="ai-duration"
            label={pl.aiDurationLabel}
            placeholder={pl.aiDurationPlaceholder}
            type="number"
            value={durationMin}
            onChange={(e) => setDurationMin(e.target.value)}
          />

          {!apiKey && (
            <FeedbackBanner variant="warning" message={pl.aiCoachNoApiKey} />
          )}

          <Button
            type="button"
            size="touch"
            fullWidth
            disabled={!apiKey || !description.trim()}
            onClick={handleGenerate}
            className="gap-2"
          >
            <Sparkles size={18} aria-hidden />
            {pl.aiGenerate}
          </Button>
        </div>
      )}

      {/* GENERATING STEP — coach thinking */}
      {step === 'generating' && (
        <div className="mt-3 flex flex-col items-center gap-4 py-8">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[var(--sr-border-subtle)] border-t-[var(--sr-brand-primary)]" />
          <p className="text-sm text-[var(--sr-text-muted)]">{pl.aiCoachGenerating}</p>
        </div>
      )}

      {/* ERROR STEP — coach explains what went wrong */}
      {step === 'error' && (
        <div className="mt-3 flex flex-col gap-4">
          <AiCoachMessage tone="warning">
            {error || pl.aiCoachErrorRetry}
          </AiCoachMessage>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={handleBackToForm}
            className="gap-2"
          >
            <RotateCcw size={18} aria-hidden />
            {pl.planBack}
          </Button>
        </div>
      )}

      {/* RESULT STEP — coach presents the plan */}
      {step === 'result' && result && (
        <div className="mt-3 flex flex-col gap-3">
          {/* Coach intro message */}
          <AiCoachMessage tone="insight">
            {pl.aiCoachPlanReady}
          </AiCoachMessage>

          {/* Plan preview card */}
          <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4">
            <h3 className="text-lg font-bold text-[var(--sr-text-primary)]">
              {result.plan.name}
            </h3>
            <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
              {result.plan.description}
            </p>

            {/* Summary stats */}
            <div className="mt-3 flex gap-4">
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-[var(--sr-text-primary)]">
                  {result.plan.days.length}
                </span>
                <span className="text-xs text-[var(--sr-text-muted)]">
                  {pl.planSummaryDays(result.plan.days.length)}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-[var(--sr-text-primary)]">
                  {result.plan.days.reduce((acc, d) => acc + d.exercises.length, 0)}
                </span>
                <span className="text-xs text-[var(--sr-text-muted)]">
                  {pl.planSummaryExercises(result.plan.days.reduce((acc, d) => acc + d.exercises.length, 0))}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold text-[var(--sr-text-primary)]">
                  {result.plan.days.reduce(
                    (acc, d) => acc + d.exercises.reduce((s, e) => s + e.sets.length, 0),
                    0,
                  )}
                </span>
                <span className="text-xs text-[var(--sr-text-muted)]">
                  {pl.planSummarySets(result.plan.days.reduce(
                    (acc, d) => acc + d.exercises.reduce((s, e) => s + e.sets.length, 0),
                    0,
                  ))}
                </span>
              </div>
            </div>
          </div>

          {/* Rationale — coach explains the "why" */}
          {result.rationale && (
            <AiCoachMessage tone="insight">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--sr-brand-primary)]">
                {pl.aiRationaleTitle}
              </p>
              {result.rationale}
            </AiCoachMessage>
          )}

          {/* New exercises info */}
          {result.newExercises.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-[var(--sr-text-muted)]">
              <Check size={16} className="text-[var(--sr-success)]" aria-hidden />
              {pl.aiNewExercises(result.newExercises.length)}
            </div>
          )}

          {/* Day preview with exercise details */}
          <div className="flex flex-col gap-2">
            {result.plan.days.map((d, i) => (
              <div
                key={i}
                className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3"
              >
                <p className="font-semibold text-[var(--sr-text-primary)]">
                  {pl.planDayLabel(d.dayNumber)}
                  <span className="ml-2 font-normal text-[var(--sr-text-muted)]">
                    {pl.planExercisesShort(d.exercises.length)}
                  </span>
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {d.exercises.map((ex, j) => {
                    const exName = exerciseNames.get(ex.exerciseId) ?? pl.exerciseFallbackName
                    return (
                      <li key={j} className="text-sm text-[var(--sr-text-secondary)]">
                        <span className="font-medium">{j + 1}. {exName}</span>
                        <span className="ml-1 text-[var(--sr-text-muted)]">
                          {' '}· {ex.sets.length} {pl.planSetsShort(ex.sets.length)}
                        </span>
                        {/* Show set details */}
                        <ul className="mt-0.5 pl-4 text-xs text-[var(--sr-text-muted)]">
                          {ex.sets.map((s, si) => (
                            <li key={si}>
                              S{si + 1}: {formatSet(s)}
                              {ex.restBetweenSetsSec ? ` · przerwa ${ex.restBetweenSetsSec}s` : ''}
                            </li>
                          ))}
                        </ul>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* Import warning */}
          <div className="flex items-start gap-2 rounded-[var(--sr-radius-sm)] bg-[var(--sr-warning-bg)] p-3 text-xs text-[var(--sr-text-secondary)]">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--sr-warning)]" aria-hidden />
            <span>{pl.aiImportWarning}</span>
          </div>

          <Button
            type="button"
            size="touch"
            fullWidth
            disabled={importing}
            onClick={handleImport}
            className="gap-2"
          >
            <Check size={18} aria-hidden />
            {importing ? pl.aiImporting : pl.aiImportPlan}
          </Button>
          <Button
            type="button"
            variant="ghost"
            fullWidth
            disabled={importing}
            onClick={handleDiscardResult}
            className="gap-2"
          >
            <RotateCcw size={16} aria-hidden />
            {pl.aiDiscard}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
