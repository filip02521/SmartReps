/**
 * Adaptive progression (Pro): AI analyzes recent session history for a custom
 * plan and PROPOSES adjustments to plan.progression / plan.deload /
 * per-exercise progression overrides.
 *
 * Safety contract — the AI never changes the plan directly:
 * 1. Output is validated against a strict schema.
 * 2. Every numeric field is clamped to hard bounds (PROGRESSION_BOUNDS).
 * 3. Unknown exercise ids are dropped.
 * 4. The result is a proposal — the UI shows a diff and the user accepts
 *    or dismisses. Nothing is applied silently.
 */

import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type {
  CustomPlan,
  ExerciseDefinition,
  ProgressionRule,
} from '@/lib/exercise-model'
import { aiChat, type AiContext } from './managed-client'
import {
  acquireInflight,
  checkRateLimit,
  recordCall,
  recordFailedCall,
  releaseInflight,
} from './rate-limiter'

/** Hard safety bounds — AI output is clamped to these before anything else. */
export const PROGRESSION_BOUNDS = {
  repsDelta: { min: -5, max: 5 },
  weightKgDelta: { min: -10, max: 10 },
  durationSecDelta: { min: -30, max: 30 },
  deloadEveryNCycles: { min: 2, max: 8 },
} as const

/** Minimum completed plan sessions before AI has enough signal. */
export const ADAPTIVE_MIN_SESSIONS = 3

const MAX_HISTORY_SESSIONS = 10

export type ExerciseProposal = {
  exerciseId: string
  repsDelta: number | null
  weightKgDelta: number | null
  durationSecDelta: number | null
}

export type AdaptiveProposal = {
  /** Whether plan-level progression should run after each cycle. */
  enabled: boolean
  repsDelta: number | null
  weightKgDelta: number | null
  durationSecDelta: number | null
  /** Every-Nth-cycle deload; null = disabled. */
  deloadEveryNCycles: number | null
  perExercise: ExerciseProposal[]
  rationale: string
}

export type AdaptiveResult =
  | { kind: 'proposal'; proposal: AdaptiveProposal; changed: boolean }
  | { kind: 'insufficient_data'; sessions: number }
  | { kind: 'cooldown'; retryAfterMs: number }
  | { kind: 'rate_limited' }
  | { kind: 'error' }

// ── History extraction ──

type ExerciseStats = {
  exerciseId: string
  name: string
  metric: string
  targetLabel: string
  sets: number
  passRate: number
  avgReps: number | null
  avgWeightKg: number | null
  avgDurationSec: number | null
  avgRpe: number | null
}

/** Aggregate per-exercise performance across the plan's recent sessions. */
export async function collectPlanExerciseStats(
  plan: CustomPlan,
  exercisesById: Map<string, ExerciseDefinition>,
): Promise<{ sessions: number; stats: ExerciseStats[] }> {
  const sessions = (await db.workoutSessions.toArray())
    .filter((s) => s.program === 'custom' && s.customPlanId === plan.id && s.status === 'completed')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, MAX_HISTORY_SESSIONS)

  const byExercise = new Map<
    string,
    { sets: number; passed: number; reps: number[]; kg: number[]; sec: number[]; rpe: number[] }
  >()
  for (const s of sessions) {
    for (const log of s.exerciseLogs ?? []) {
      const e = byExercise.get(log.exerciseId) ?? {
        sets: 0,
        passed: 0,
        reps: [],
        kg: [],
        sec: [],
        rpe: [],
      }
      for (const set of log.sets) {
        e.sets++
        if (set.passed) e.passed++
        if (set.actual.reps != null) e.reps.push(set.actual.reps)
        if (set.actual.weightKg != null) e.kg.push(set.actual.weightKg)
        if (set.actual.durationSec != null) e.sec.push(set.actual.durationSec)
        if (set.rpe != null) e.rpe.push(set.rpe)
      }
      byExercise.set(log.exerciseId, e)
    }
  }

  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)
  const stats: ExerciseStats[] = []
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      const def = exercisesById.get(ex.exerciseId)
      const agg = byExercise.get(ex.exerciseId)
      const firstSet = ex.sets[0]
      const targetParts: string[] = []
      if (firstSet?.reps) {
        targetParts.push(
          firstSet.reps.kind === 'max'
            ? `max≥${firstSet.reps.minValue}`
            : `${ex.sets.length}×${firstSet.reps.value}`,
        )
      }
      if (firstSet?.durationSec && firstSet.durationSec.kind !== 'max') {
        targetParts.push(`${ex.sets.length}×${firstSet.durationSec.value}s`)
      }
      if (firstSet?.weightKg && firstSet.weightKg.kind !== 'max') {
        targetParts.push(`@${firstSet.weightKg.value}kg`)
      }
      stats.push({
        exerciseId: ex.exerciseId,
        name: def?.name ?? ex.exerciseId,
        metric: def?.primaryMetric ?? 'reps',
        targetLabel: targetParts.join(' '),
        sets: agg?.sets ?? 0,
        passRate: agg && agg.sets > 0 ? agg.passed / agg.sets : 0,
        avgReps: avg(agg?.reps ?? []),
        avgWeightKg: avg(agg?.kg ?? []),
        avgDurationSec: avg(agg?.sec ?? []),
        avgRpe: avg(agg?.rpe ?? []),
      })
    }
  }
  return { sessions: sessions.length, stats }
}

// ── Proposal validation ──

/** Integer-only fields — fractional reps/duration/cycle-count are meaningless
 *  (and a fractional everyNCycles would make `attempt % n === 0` never fire). */
function clampInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, Math.round(v)))
}

/** Weight deltas snap to 0.5 kg — the smallest useful plate step. */
function clampHalfKg(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, Math.round(v * 2) / 2))
}

/** Validate + clamp raw AI output into a safe proposal. Exported for tests. */
export function parseAdaptiveProposal(raw: unknown, plan: CustomPlan): AdaptiveProposal | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const b = PROGRESSION_BOUNDS

  const planExerciseIds = new Set(plan.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))

  const perExercise: ExerciseProposal[] = []
  if (Array.isArray(o.perExercise)) {
    for (const item of o.perExercise) {
      if (!item || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      if (typeof p.exerciseId !== 'string' || !planExerciseIds.has(p.exerciseId)) continue
      const entry: ExerciseProposal = {
        exerciseId: p.exerciseId,
        repsDelta: clampInt(p.repsDelta, b.repsDelta.min, b.repsDelta.max),
        weightKgDelta: clampHalfKg(
          p.weightKgDelta,
          b.weightKgDelta.min,
          b.weightKgDelta.max,
        ),
        durationSecDelta: clampInt(
          p.durationSecDelta,
          b.durationSecDelta.min,
          b.durationSecDelta.max,
        ),
      }
      // Drop entries that change nothing.
      if (entry.repsDelta != null || entry.weightKgDelta != null || entry.durationSecDelta != null) {
        perExercise.push(entry)
      }
    }
  }

  const rationale = typeof o.rationale === 'string' ? o.rationale.trim().slice(0, 400) : ''
  if (!rationale) return null

  const deloadRaw = clampInt(
    o.deloadEveryNCycles,
    b.deloadEveryNCycles.min,
    b.deloadEveryNCycles.max,
  )

  return {
    enabled: typeof o.enabled === 'boolean' ? o.enabled : true,
    repsDelta: clampInt(o.repsDelta, b.repsDelta.min, b.repsDelta.max),
    weightKgDelta: clampHalfKg(o.weightKgDelta, b.weightKgDelta.min, b.weightKgDelta.max),
    durationSecDelta: clampInt(
      o.durationSecDelta,
      b.durationSecDelta.min,
      b.durationSecDelta.max,
    ),
    deloadEveryNCycles: o.deloadEveryNCycles == null ? null : deloadRaw,
    perExercise,
    rationale,
  }
}

/** Current per-exercise progression overrides, keyed by exerciseId. */
function currentOverrides(plan: CustomPlan): Map<string, ProgressionRule> {
  const out = new Map<string, ProgressionRule>()
  for (const day of plan.days) {
    for (const ex of day.exercises) {
      if (ex.progression != null) out.set(ex.exerciseId, ex.progression)
    }
  }
  return out
}

/**
 * Delta merge semantics shared by diff + apply:
 *   null/omitted field → keep the current value (AI has no opinion)
 *   0                  → explicitly clear the delta
 *   other              → set to the proposed value
 */
function mergeDelta(proposed: number | null, current: number | undefined): number | undefined {
  if (proposed == null) return current
  return proposed === 0 ? undefined : proposed
}

function deltaFields(
  rule: Pick<ProgressionRule, 'repsDelta' | 'weightKgDelta' | 'durationSecDelta'>,
): Pick<ProgressionRule, 'repsDelta' | 'weightKgDelta' | 'durationSecDelta'> {
  return {
    ...(rule.repsDelta != null ? { repsDelta: rule.repsDelta } : {}),
    ...(rule.weightKgDelta != null ? { weightKgDelta: rule.weightKgDelta } : {}),
    ...(rule.durationSecDelta != null ? { durationSecDelta: rule.durationSecDelta } : {}),
  }
}

/** Whether the proposal actually differs from the plan's current rules. */
export function proposalChangesPlan(plan: CustomPlan, p: AdaptiveProposal): boolean {
  const cur = plan.progression
  const curEnabled = cur?.enabled ?? false
  if (p.enabled !== curEnabled) return true
  if (p.enabled) {
    if ((mergeDelta(p.repsDelta, cur?.repsDelta) ?? 0) !== (cur?.repsDelta ?? 0)) return true
    if ((mergeDelta(p.weightKgDelta, cur?.weightKgDelta) ?? 0) !== (cur?.weightKgDelta ?? 0))
      return true
    if (
      (mergeDelta(p.durationSecDelta, cur?.durationSecDelta) ?? 0) !==
      (cur?.durationSecDelta ?? 0)
    )
      return true
  }
  const curDeload = plan.deload?.enabled ? plan.deload.everyNCycles : null
  if (p.deloadEveryNCycles !== curDeload) return true

  // The proposal is the COMPLETE new per-exercise state — overrides absent
  // from it are removed on apply, and changed values count as a diff.
  const existing = currentOverrides(plan)
  const proposedIds = new Set(p.perExercise.map((e) => e.exerciseId))
  for (const id of existing.keys()) {
    if (!proposedIds.has(id)) return true
  }
  for (const prop of p.perExercise) {
    const cur2 = existing.get(prop.exerciseId)
    if (!cur2) return true
    if (
      (mergeDelta(prop.repsDelta, cur2.repsDelta) ?? 0) !== (cur2.repsDelta ?? 0) ||
      (mergeDelta(prop.weightKgDelta, cur2.weightKgDelta) ?? 0) !==
        (cur2.weightKgDelta ?? 0) ||
      (mergeDelta(prop.durationSecDelta, cur2.durationSecDelta) ?? 0) !==
        (cur2.durationSecDelta ?? 0) ||
      cur2.enabled === false
    ) {
      return true
    }
  }
  return false
}

// ── Apply (called only on explicit user accept) ──

/** Produce the updated plan with the accepted proposal applied. */
export function applyProposalToPlan(plan: CustomPlan, p: AdaptiveProposal): CustomPlan {
  const curRule = plan.progression
  const rule: ProgressionRule | null = p.enabled
    ? {
        enabled: true,
        // Preserve the user's trigger choice; default to per-cycle.
        afterCycleComplete: curRule?.afterCycleComplete ?? true,
        ...deltaFields({
          repsDelta: mergeDelta(p.repsDelta, curRule?.repsDelta),
          weightKgDelta: mergeDelta(p.weightKgDelta, curRule?.weightKgDelta),
          durationSecDelta: mergeDelta(p.durationSecDelta, curRule?.durationSecDelta),
        }),
      }
    : curRule
      ? { ...curRule, enabled: false }
      : null

  const deload =
    p.deloadEveryNCycles != null
      ? {
          // Keep configured deload deltas — everyNCycles is the only field
          // the AI controls.
          ...(plan.deload ?? {}),
          enabled: true,
          everyNCycles: p.deloadEveryNCycles,
        }
      : plan.deload
        ? { ...plan.deload, enabled: false }
        : null

  const overrides = new Map(p.perExercise.map((e) => [e.exerciseId, e]))
  const days = plan.days.map((day) => ({
    ...day,
    exercises: day.exercises.map((ex) => {
      const o = overrides.get(ex.exerciseId)
      if (!o) {
        // Proposal is the complete new state — clear overrides the AI did
        // not carry over so a stale rule can't keep firing silently.
        return ex.progression != null ? { ...ex, progression: null } : ex
      }
      const cur2 = ex.progression
      const exerciseRule: ProgressionRule = {
        enabled: true,
        afterCycleComplete: cur2?.afterCycleComplete ?? true,
        ...deltaFields({
          repsDelta: mergeDelta(o.repsDelta, cur2?.repsDelta),
          weightKgDelta: mergeDelta(o.weightKgDelta, cur2?.weightKgDelta),
          durationSecDelta: mergeDelta(o.durationSecDelta, cur2?.durationSecDelta),
        }),
      }
      return { ...ex, progression: exerciseRule }
    }),
  }))

  return {
    ...plan,
    days,
    progression: rule,
    deload,
    updatedAt: new Date().toISOString(),
  }
}

// ── AI call ──

/**
 * Ask AI for a progression proposal for a custom plan. Returns a validated,
 * clamped proposal — or a typed reason when unavailable. Never mutates state.
 */
export async function requestAdaptiveProgression(
  plan: CustomPlan,
  exercisesById: Map<string, ExerciseDefinition>,
  aiConfig: AiContext,
): Promise<AdaptiveResult> {
  const { sessions, stats } = await collectPlanExerciseStats(plan, exercisesById)
  if (sessions < ADAPTIVE_MIN_SESSIONS) {
    return { kind: 'insufficient_data', sessions }
  }

  // Client-side rate limit mirrors every other AI feature — the 6h cooldown
  // bounds cost; the server-side daily quota still applies on top.
  const rl = checkRateLimit('progression_adaptation')
  if (!rl.allowed) {
    return rl.reason === 'cooldown'
      ? { kind: 'cooldown', retryAfterMs: rl.retryAfterMs }
      : { kind: 'rate_limited' }
  }

  const overridesByExercise = currentOverrides(plan)
  const payload = {
    plan: {
      name: plan.name,
      days: plan.days.length,
      currentProgression: plan.progression ?? null,
      currentDeload: plan.deload ?? null,
    },
    recentSessions: sessions,
    exercises: stats.map((s) => ({
      exerciseId: s.exerciseId,
      name: s.name,
      metric: s.metric,
      target: s.targetLabel,
      setsLogged: s.sets,
      passRate: Math.round(s.passRate * 100) / 100,
      avgReps: s.avgReps == null ? null : Math.round(s.avgReps * 10) / 10,
      avgWeightKg: s.avgWeightKg,
      avgDurationSec: s.avgDurationSec,
      avgRpe: s.avgRpe == null ? null : Math.round(s.avgRpe * 10) / 10,
      // The model must see existing per-exercise overrides — otherwise it
      // proposes blind and the diff/apply semantics lose information.
      currentOverride: overridesByExercise.get(s.exerciseId) ?? null,
    })),
  }

  acquireInflight('progression_adaptation')
  try {
    const result = await aiChat(aiConfig, {
      feature: 'progression_adaptation',
      messages: [
        { role: 'system', content: pl.aiPromptAdaptiveSystem },
        { role: 'user', content: JSON.stringify(payload) },
      ],
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 1200,
    })
    recordCall('progression_adaptation')
    let raw: unknown
    try {
      raw = JSON.parse(result.content)
    } catch {
      return { kind: 'error' }
    }
    const proposal = parseAdaptiveProposal(raw, plan)
    if (!proposal) return { kind: 'error' }
    return { kind: 'proposal', proposal, changed: proposalChangesPlan(plan, proposal) }
  } catch {
    recordFailedCall('progression_adaptation')
    return { kind: 'error' }
  } finally {
    releaseInflight('progression_adaptation')
  }
}
