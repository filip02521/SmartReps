import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FeedbackBanner } from '@/components/ux/Feedback'
import { PageSection } from '@/components/ui/PageSection'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { listExercises } from '@/lib/custom-plan-service'
import { analyzeWorkouts, type AnalysisResult } from '@/lib/ai/workout-analyzer'
import { AiApiError } from '@/lib/ai/ai-client'
import { Sparkles, TrendingUp, AlertTriangle, Check, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRIORITY_COLORS = {
  high: 'border-l-[var(--sr-error)]',
  medium: 'border-l-[var(--sr-warning)]',
  low: 'border-l-[var(--sr-success)]',
}

const STATUS_COLORS = {
  optimal: 'text-[var(--sr-success)]',
  below_mev: 'text-[var(--sr-warning)]',
  above_mrv: 'text-[var(--sr-error)]',
  low: 'text-[var(--sr-warning)]',
  high: 'text-[var(--sr-warning)]',
}

const STATUS_LABELS = {
  optimal: pl.aiStatusOptimal,
  below_mev: pl.aiStatusBelowMev,
  above_mrv: pl.aiStatusAboveMrv,
  low: pl.aiStatusLow,
  high: pl.aiStatusHigh,
}

export function AiWorkoutAnalysis() {
  const { settings } = useAppStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)

  const apiKey = settings.aiApiKey ?? ''
  const model = settings.aiModel ?? 'gpt-4o-mini'
  const baseURL = settings.aiBaseUrl ?? ''

  function handleAnalyze() {
    if (!apiKey) {
      setError(pl.aiNoApiKey)
      return
    }
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const exercises = await listExercises()
        const res = await analyzeWorkouts({ apiKey, model, exercises, baseURL: baseURL || undefined })
        setResult(res)
      } catch (e) {
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
          console.error('[AI Workout Analysis] Unexpected error:', e)
          setError(
            e instanceof Error
              ? `${pl.aiErrorGeneric} (${e.message})`
              : pl.aiErrorGeneric,
          )
        }
      } finally {
        setLoading(false)
      }
    })()
  }

  return (
    <PageSection title={pl.aiAnalysisTitle} hint={pl.aiAnalysisHint}>
      {!apiKey && (
        <FeedbackBanner variant="warning" message={pl.aiNoApiKey} />
      )}

      {error && (
        <div className="mb-3">
          <FeedbackBanner variant="error" message={error} />
        </div>
      )}

      {!result && !loading && (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={!apiKey}
          onClick={handleAnalyze}
          className="gap-2"
        >
          <Sparkles size={18} aria-hidden />
          {pl.aiAnalyze}
        </Button>
      )}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-border-subtle)] border-t-[var(--sr-brand-primary)]" />
          <p className="text-sm text-[var(--sr-text-muted)]">{pl.aiAnalyzing}</p>
        </div>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-4">
          {/* Summary */}
          <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
            <p className="text-sm text-[var(--sr-text-secondary)]">{result.summary}</p>
          </div>

          {/* Strengths */}
          {result.strengths.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--sr-success)]">
                <Check size={16} aria-hidden />
                {pl.aiStrengths}
              </p>
              <ul className="flex flex-col gap-1">
                {result.strengths.map((s, i) => (
                  <li key={i} className="text-sm text-[var(--sr-text-secondary)]">
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {result.weaknesses.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--sr-warning)]">
                <AlertTriangle size={16} aria-hidden />
                {pl.aiWeaknesses}
              </p>
              <ul className="flex flex-col gap-1">
                {result.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm text-[var(--sr-text-secondary)]">
                    • {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Volume assessment */}
          {result.volumeAssessment.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--sr-text-primary)]">
                <TrendingUp size={16} aria-hidden />
                {pl.aiVolumeAssessment}
              </p>
              <ul className="flex flex-col gap-2">
                {result.volumeAssessment.map((v, i) => {
                  const label = result.muscleGroupLabels[v.muscleGroup] ?? v.muscleGroup
                  const status = v.status as keyof typeof STATUS_COLORS
                  return (
                    <li
                      key={i}
                      className="rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[var(--sr-text-primary)]">
                          {label}
                        </span>
                        <span className={cn('text-xs font-semibold', STATUS_COLORS[status])}>
                          {v.weeklySets} serii/tyg — {STATUS_LABELS[status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                        {v.recommendation}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-[var(--sr-text-primary)]">
                <Lightbulb size={16} aria-hidden />
                {pl.aiSuggestions}
              </p>
              <ul className="flex flex-col gap-2">
                {result.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className={cn(
                      'rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] border-l-4 p-3',
                      PRIORITY_COLORS[s.priority],
                    )}
                  >
                    <p className="text-sm font-medium text-[var(--sr-text-primary)]">
                      {s.title}
                    </p>
                    <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
                      {s.description}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                      {s.priority === 'high'
                        ? pl.aiPriorityHigh
                        : s.priority === 'medium'
                          ? pl.aiPriorityMedium
                          : pl.aiPriorityLow}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => setResult(null)}
          >
            {pl.aiAnalyzeAgain}
          </Button>
        </div>
      )}
    </PageSection>
  )
}
