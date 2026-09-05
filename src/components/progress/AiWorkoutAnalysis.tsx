import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FeedbackBanner } from '@/components/ux/Feedback'
import { PageSection } from '@/components/ui/PageSection'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { listExercises } from '@/lib/custom-plan-service'
import { analyzeWorkouts, type AnalysisResult } from '@/lib/ai/workout-analyzer'
import { AiApiError } from '@/lib/ai/ai-client'
import {
  checkRateLimit,
  acquireInflight,
  releaseInflight,
  recordCall,
  formatCooldownRemaining,
} from '@/lib/ai/rate-limiter'
import { AiCoachHeader, AiCoachMessage } from '@/components/brand/AiCoachHeader'
import { TrendingUp, AlertTriangle, Check, Lightbulb, RotateCcw } from 'lucide-react'
import { db } from '@/lib/db'
import { cn } from '@/lib/utils'

const ANALYSIS_CACHE_ID = 'latest'
const ANALYSIS_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours — analysis is expensive

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
  const [hasSessions, setHasSessions] = useState<boolean | null>(null)
  const [cacheAge, setCacheAge] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Abort any in-flight AI request on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const apiKey = settings.aiApiKey ?? ''
  const model = settings.aiModel ?? 'gpt-4o-mini'
  const baseURL = settings.aiBaseUrl ?? ''

  // Check if there are any completed sessions to analyze + load cached analysis
  useEffect(() => {
    void db.workoutSessions
      .filter((s) => s.status === 'completed')
      .count()
      .then((n) => setHasSessions(n > 0))
      .catch(() => setHasSessions(false))

    // Load cached analysis result so it survives page refresh / tab switch
    void db.aiAnalysisCache
      .get(ANALYSIS_CACHE_ID)
      .then((cached) => {
        if (cached) {
          try {
            const age = Date.now() - new Date(cached.createdAt).getTime()
            // Show cache age if fresh (< 24h), mark stale otherwise
            if (age < ANALYSIS_TTL_MS) {
              setCacheAge(formatAge(age))
            } else {
              setCacheAge(pl.aiAnalysisCacheStale)
            }
            setResult(JSON.parse(cached.resultJson))
          } catch {
            // Corrupted cache — ignore
          }
        }
      })
      .catch(() => {})
  }, [])

  function formatAge(ms: number): string {
    const hours = Math.floor(ms / (60 * 60 * 1000))
    if (hours >= 1) return `${hours} h`
    const minutes = Math.floor(ms / (60 * 1000))
    return `${minutes} min`
  }

  function handleAnalyze() {
    if (!apiKey) {
      setError(pl.aiCoachNoApiKey)
      return
    }
    // Rate limit check
    const rl = checkRateLimit('workout_analysis')
    if (!rl.allowed) {
      if (rl.reason === 'cooldown') {
        setError(pl.aiRateLimitCooldown(formatCooldownRemaining(rl.retryAfterMs)))
      } else if (rl.reason === 'quota') {
        setError(pl.aiRateLimitQuota(rl.quota - rl.dailyCount, rl.quota))
      } else {
        setError(pl.aiRateLimitInflight)
      }
      return
    }
    setLoading(true)
    setError('')
    // Cancel any previous request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    // 60s timeout — analysis is a large request, but still bounded
    const timeout = setTimeout(() => controller.abort(), 60_000)
    acquireInflight()
    void (async () => {
      try {
        const exercises = await listExercises()
        if (controller.signal.aborted) return
        const res = await analyzeWorkouts({ apiKey, model, exercises, baseURL: baseURL || undefined, signal: controller.signal })
        if (controller.signal.aborted) return
        recordCall('workout_analysis')
        setResult(res)
        setCacheAge(null)
        // Persist to cache so analysis survives refresh / tab switch
        void db.aiAnalysisCache.put({
          id: ANALYSIS_CACHE_ID,
          resultJson: JSON.stringify(res),
          createdAt: new Date().toISOString(),
        }).catch(() => {})
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
          console.error('[AI Workout Analysis] Unexpected error:', e)
          setError(
            e instanceof Error
              ? `${pl.aiErrorGeneric} (${e.message})`
              : pl.aiErrorGeneric,
          )
        }
      } finally {
        clearTimeout(timeout)
        releaseInflight()
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
  }

  return (
    <PageSection title={pl.aiAnalysisTitle} hint={pl.aiAnalysisHint}>
      {/* Coach header — always visible, establishes persona */}
      <AiCoachHeader
        subtitle={pl.aiCoachTagline}
        status={
          loading
            ? pl.aiCoachAnalyzing
            : result
              ? pl.aiCoachAnalysisDone
              : error
                ? pl.aiCoachErrorRetry
                : pl.aiCoachReady
        }
        pulse={loading}
      />

      {/* Coach greeting — before first analysis */}
      {!result && !loading && !error && hasSessions && (
        <AiCoachMessage tone="insight" className="mt-3">
          {pl.aiCoachGreeting}
        </AiCoachMessage>
      )}

      {/* Empty state — no workouts to analyze */}
      {!result && !loading && !error && hasSessions === false && (
        <AiCoachMessage tone="default" className="mt-3">
          {pl.aiAnalysisEmpty}
        </AiCoachMessage>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3">
          <FeedbackBanner variant="error" message={error} />
        </div>
      )}

      {/* CTA — before first analysis or after error (only if sessions exist) */}
      {!result && !loading && hasSessions && (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={!apiKey}
          onClick={handleAnalyze}
          className="mt-3 gap-2"
        >
          {pl.aiAnalyze}
        </Button>
      )}

      {/* Loading — coach thinking state */}
      {loading && (
        <div className="mt-3 flex flex-col items-center gap-3 py-6">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--sr-border-subtle)] border-t-[var(--sr-brand-primary)]" />
          <p className="text-sm text-[var(--sr-text-muted)]">{pl.aiCoachAnalyzing}</p>
        </div>
      )}

      {/* Results — coach conversation layout */}
      {result && !loading && (
        <div className="mt-3 flex flex-col gap-3">
          {/* Cache age indicator */}
          {cacheAge && (
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
              {cacheAge}
            </p>
          )}
          {/* Summary — coach's opening message */}
          <AiCoachMessage tone="insight">
            {result.summary}
          </AiCoachMessage>

          {/* Strengths */}
          {result.strengths.length > 0 && (
            <AiCoachMessage tone="success">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--sr-success)]">
                <Check size={16} aria-hidden />
                {pl.aiStrengths}
              </p>
              <ul className="flex flex-col gap-1">
                {result.strengths.map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </AiCoachMessage>
          )}

          {/* Weaknesses */}
          {result.weaknesses.length > 0 && (
            <AiCoachMessage tone="warning">
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--sr-warning)]">
                <AlertTriangle size={16} aria-hidden />
                {pl.aiWeaknesses}
              </p>
              <ul className="flex flex-col gap-1">
                {result.weaknesses.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </AiCoachMessage>
          )}

          {/* Volume assessment */}
          {result.volumeAssessment.length > 0 && (
            <AiCoachMessage>
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--sr-text-primary)]">
                <TrendingUp size={16} aria-hidden />
                {pl.aiVolumeAssessment}
              </p>
              <ul className="flex flex-col gap-2">
                {result.volumeAssessment.map((v, i) => {
                  const label = result.muscleGroupLabels[v.muscleGroup] ?? v.muscleGroup
                  const status = v.status as keyof typeof STATUS_COLORS
                  const statusColor = STATUS_COLORS[status] ?? 'text-[var(--sr-text-muted)]'
                  const statusLabel = STATUS_LABELS[status] ?? v.status
                  return (
                    <li
                      key={i}
                      className="rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[var(--sr-text-primary)]">
                          {label}
                        </span>
                        <span className={cn('text-xs font-semibold', statusColor)}>
                          {v.weeklySets} {pl.setsShort}/tyg — {statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                        {v.recommendation}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </AiCoachMessage>
          )}

          {/* Suggestions */}
          {result.suggestions.length > 0 && (
            <AiCoachMessage>
              <p className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--sr-text-primary)]">
                <Lightbulb size={16} aria-hidden />
                {pl.aiSuggestions}
              </p>
              <ul className="flex flex-col gap-2">
                {result.suggestions.map((s, i) => (
                  <li
                    key={i}
                    className={cn(
                      'rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] border-l-4 bg-[var(--sr-bg-surface)] p-3',
                      PRIORITY_COLORS[s.priority] ?? 'border-l-[var(--sr-border-subtle)]',
                    )}
                  >
                    <p className="font-medium text-[var(--sr-text-primary)]">
                      {s.title}
                    </p>
                    <p className="mt-1 text-[var(--sr-text-secondary)]">
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
            </AiCoachMessage>
          )}

          <Button
            type="button"
            variant="ghost"
            fullWidth
            onClick={() => {
              setResult(null)
              void db.aiAnalysisCache.delete(ANALYSIS_CACHE_ID).catch(() => {})
            }}
            className="mt-1 gap-2"
          >
            <RotateCcw size={16} aria-hidden />
            {pl.aiAnalyzeAgain}
          </Button>
        </div>
      )}
    </PageSection>
  )
}
