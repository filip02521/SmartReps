import { useEffect, useState } from 'react'
import { Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { CustomPlan, ExerciseDefinition } from '@/lib/exercise-model'
import { saveCustomPlan } from '@/lib/custom-plan-service'
import { resolveAiContext } from '@/lib/ai/managed-client'
import { useAppStore } from '@/stores/app-store'
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth'
import { useProFeatures } from '@/lib/subscription'
import { showToast } from '@/stores/toast-store'
import {
  ADAPTIVE_MIN_SESSIONS,
  applyProposalToPlan,
  requestAdaptiveProgression,
  type AdaptiveProposal,
  type AdaptiveResult,
} from '@/lib/ai/adaptive-progression'
import { formatCooldownRemaining } from '@/lib/ai/rate-limiter'

type Phase =
  | { kind: 'loading' }
  | { kind: 'result'; result: AdaptiveResult }
  | { kind: 'applying' }

function deltaLabel(p: AdaptiveProposal): string[] {
  const parts: string[] = []
  if (p.repsDelta != null && p.repsDelta !== 0) parts.push(pl.adaptiveDeltaReps(p.repsDelta))
  if (p.weightKgDelta != null && p.weightKgDelta !== 0)
    parts.push(pl.adaptiveDeltaWeight(p.weightKgDelta))
  if (p.durationSecDelta != null && p.durationSecDelta !== 0)
    parts.push(pl.adaptiveDeltaDuration(p.durationSecDelta))
  return parts
}

function ruleDeltaParts(rule: {
  repsDelta?: number
  weightKgDelta?: number
  durationSecDelta?: number
}): string[] {
  const parts: string[] = []
  if (rule.repsDelta) parts.push(pl.adaptiveDeltaReps(rule.repsDelta))
  if (rule.weightKgDelta) parts.push(pl.adaptiveDeltaWeight(rule.weightKgDelta))
  if (rule.durationSecDelta) parts.push(pl.adaptiveDeltaDuration(rule.durationSecDelta))
  return parts
}

function currentRuleLabel(plan: CustomPlan): string[] {
  const cur = plan.progression
  const parts: string[] = cur?.enabled ? [pl.adaptiveProgressionOn] : [pl.adaptiveProgressionOff]
  if (cur?.enabled) parts.push(...ruleDeltaParts(cur))
  if (plan.deload?.enabled) parts.push(pl.adaptiveDeloadEvery(plan.deload.everyNCycles))
  return parts
}

/** Existing per-exercise overrides — shown so the diff is honest about what
 *  applying the proposal replaces. */
function currentOverrideLines(
  plan: CustomPlan,
  names: Map<string, string>,
): { id: string; line: string }[] {
  const out: { id: string; line: string }[] = []
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      if (ex.progression == null) continue
      const deltas = ruleDeltaParts(ex.progression)
      out.push({
        id: ex.exerciseId,
        line: `${names.get(ex.exerciseId) ?? pl.exerciseFallbackName}: ${
          ex.progression.enabled ? deltas.join(' · ') || pl.adaptiveProgressionOn : pl.adaptiveProgressionOff
        }`,
      })
    }
  }
  return out
}

/**
 * Adaptive progression proposal sheet — Pro only. Shows the AI proposal as
 * a diff vs the plan's current rules; applies only on explicit accept.
 */
export function AdaptiveProgressionSheet({
  plan,
  open,
  onClose,
  onApplied,
}: {
  plan: CustomPlan
  open: boolean
  onClose: () => void
  onApplied: () => void
}) {
  const pro = useProFeatures()
  const { loggedIn } = useSupabaseAuth()
  const settings = useAppStore((s) => s.settings)
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [exerciseNames, setExerciseNames] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (!open) return
    setPhase({ kind: 'loading' })
    let cancelled = false

    void (async () => {
      const exercises = await db.exercises.toArray()
      const byId = new Map<string, ExerciseDefinition>(exercises.map((e) => [e.id, e]))
      if (cancelled) return
      setExerciseNames(new Map(exercises.map((e) => [e.id, e.name])))

      const aiConfig = resolveAiContext(settings, loggedIn === true, pro)
      if (!aiConfig) {
        setPhase({ kind: 'result', result: { kind: 'error' } })
        return
      }
      const result = await requestAdaptiveProgression(plan, byId, aiConfig)
      if (!cancelled) setPhase({ kind: 'result', result })
    })()

    return () => {
      cancelled = true
    }
    // plan/settings identity churn — key the analysis on plan id + open.
  }, [open, plan.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (proposal: AdaptiveProposal) => {
    setPhase({ kind: 'applying' })
    try {
      // Re-read the plan at apply time — the prop is a snapshot from when
      // the sheet opened; edits made meanwhile must not be overwritten.
      const latest = (await db.customPlans.get(plan.id)) ?? plan
      const next = applyProposalToPlan(latest, proposal)
      await saveCustomPlan(next, { skipValidation: true })
      showToast(pl.adaptiveApplied, 'success')
      onApplied()
      onClose()
    } catch {
      showToast(pl.adaptiveError, 'error')
      setPhase({ kind: 'result', result: { kind: 'error' } })
    }
  }

  const result = phase.kind === 'result' ? phase.result : null
  const proposal = result?.kind === 'proposal' ? result.proposal : null

  return (
    <Sheet open={open} onClose={onClose} title={pl.adaptiveTitle} elevated>
      <div className="flex flex-col gap-4">
        {phase.kind === 'loading' && (
          <div
            role="status"
            className="flex items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4"
          >
            <Loader2 size={18} className="animate-spin text-[var(--sr-brand-primary)]" aria-hidden />
            <p className="text-sm text-[var(--sr-text-secondary)]">{pl.adaptiveAnalyzing}</p>
          </div>
        )}

        {result?.kind === 'insufficient_data' && (
          <p className="text-sm text-[var(--sr-text-secondary)]">
            {pl.adaptiveInsufficient(ADAPTIVE_MIN_SESSIONS)}
          </p>
        )}

        {result?.kind === 'cooldown' && (
          <p className="text-sm text-[var(--sr-text-secondary)]">
            {pl.adaptiveCooldown(formatCooldownRemaining(result.retryAfterMs))}
          </p>
        )}

        {result?.kind === 'rate_limited' && (
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.aiErrorQuotaExceeded}</p>
        )}

        {result?.kind === 'error' && (
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.adaptiveError}</p>
        )}

        {result?.kind === 'proposal' && !result.changed && (
          <p className="whitespace-pre-line text-sm text-[var(--sr-text-secondary)]">
            {pl.adaptiveNoChange}
            {proposal ? `\n${proposal.rationale}` : ''}
          </p>
        )}

        {result?.kind === 'proposal' && result.changed && proposal && (
          <>
            {/* Rationale */}
            <div className="flex items-start gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4">
              <Sparkles
                size={18}
                className="mt-0.5 shrink-0 text-[var(--sr-brand-primary)]"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="sr-text-overline mb-1 text-[var(--sr-text-muted)]">
                  {pl.adaptiveRationale}
                </p>
                <p className="text-sm leading-relaxed text-[var(--sr-text-primary)]">
                  {proposal.rationale}
                </p>
              </div>
            </div>

            {/* Current → proposed diff */}
            <div className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="sr-text-overline mb-1 text-[var(--sr-text-muted)]">
                    {pl.adaptiveCurrent}
                  </p>
                  <ul className="space-y-0.5 text-xs text-[var(--sr-text-secondary)]">
                    {currentRuleLabel(plan).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                    {currentOverrideLines(plan, exerciseNames).map((o) => (
                      <li key={o.id} className="text-[var(--sr-text-muted)]">
                        {o.line}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="sr-text-overline mb-1 text-[var(--sr-brand-primary)]">
                    {pl.adaptiveProposed}
                  </p>
                  <ul className="space-y-0.5 text-xs font-medium text-[var(--sr-text-primary)]">
                    <li className="flex items-center gap-1">
                      <TrendingUp size={12} aria-hidden />
                      {proposal.enabled ? pl.adaptiveProgressionOn : pl.adaptiveProgressionOff}
                    </li>
                    {deltaLabel(proposal).map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                    <li>
                      {proposal.deloadEveryNCycles != null
                        ? pl.adaptiveDeloadEvery(proposal.deloadEveryNCycles)
                        : pl.adaptiveDeloadOff}
                    </li>
                  </ul>
                </div>
              </div>

              {/* Per-exercise overrides */}
              {proposal.perExercise.length > 0 && (
                <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3">
                  <p className="sr-text-overline mb-1.5 text-[var(--sr-text-muted)]">
                    {pl.adaptivePerExercise}
                  </p>
                  <ul className="space-y-1 text-xs text-[var(--sr-text-secondary)]">
                    {proposal.perExercise.map((e) => (
                      <li key={e.exerciseId} className="flex justify-between gap-2">
                        <span className="truncate">
                          {exerciseNames.get(e.exerciseId) ?? pl.exerciseFallbackName}
                        </span>
                        <span className="shrink-0 font-medium text-[var(--sr-text-primary)]">
                          {[
                            e.repsDelta != null && e.repsDelta !== 0
                              ? pl.adaptiveDeltaReps(e.repsDelta)
                              : null,
                            e.weightKgDelta != null && e.weightKgDelta !== 0
                              ? pl.adaptiveDeltaWeight(e.weightKgDelta)
                              : null,
                            e.durationSecDelta != null && e.durationSecDelta !== 0
                              ? pl.adaptiveDeltaDuration(e.durationSecDelta)
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2">
          {result?.kind === 'proposal' && result.changed && proposal && (
            <Button
              variant="primary"
              fullWidth
              disabled={phase.kind === 'applying'}
              onClick={() => void apply(proposal)}
            >
              {phase.kind === 'applying' && (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              )}
              {pl.adaptiveApply}
            </Button>
          )}
          <Button variant="secondary" fullWidth onClick={onClose}>
            {result?.kind === 'proposal' ? pl.adaptiveKeep : pl.close}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
