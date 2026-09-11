/**
 * RPE/RIR-based progression analysis.
 *
 * Grounded in:
 * - Helms ER, et al. — RPE/RIR-based load prescription
 * - Israetel M, Hoffmann A — volume landmarks & periodization
 * - Zourdos MC, et al. (2016) — RPE accuracy for 1RM estimation
 *
 * Design principles:
 * - Conservative: never suggest aggressive jumps based on a single light session
 * - RPE-aware: use average RPE across all sets, not just the last set
 * - Failed-set-aware: if any set failed, never suggest increasing load
 * - Trend-aware: require 2+ consecutive previous sessions of low/high RPE before suggesting change
 * - Safe: deload suggestion when RPE 10 sustained across 3+ total sessions (2+ previous)
 * - No single-session suggestions: without sustained trend, always maintain and observe
 */

import type { SetResultDraft } from '@/lib/progress-engine'
import type { ExerciseLog } from '@/lib/exercise-model'
import { rpeToRir, rirToRpe } from '@/lib/exercise-model'

// ─── Types ───────────────────────────────────────────────────────────────────

export type ProgressionKind =
  | 'increase_reps'
  | 'increase_weight'
  | 'maintain'
  | 'reduce_volume'
  | 'deload'

export type ProgressionSuggestion = {
  kind: ProgressionKind
  /** Human-readable reason (i18n key is resolved by caller). */
  reasonKey: string
  reasonParams?: (string | number)[]
  /** Suggested delta for the next session. */
  delta?: { reps?: number; weightKg?: number; volumePct?: number }
  /** Confidence based on data quality (number of sessions, consistency). */
  confidence: 'high' | 'medium' | 'low'
  /** Average RPE across analyzed sets (null if no RPE data). */
  avgRpe: number | null
  /** Average RIR across analyzed sets (null if no RIR data). */
  avgRir: number | null
  /** Number of sets with RPE/RIR data. */
  setsWithEffort: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract RPE from a builtin set result, converting RIR to RPE if needed. */
export function setRpeValue(set: SetResultDraft): number | null {
  if (set.rpe != null) return set.rpe
  if (set.rir != null) return rirToRpe(set.rir)
  return null
}

/** Extract RIR from a builtin set result, converting RPE to RIR if needed. */
export function setRirValue(set: SetResultDraft): number | null {
  if (set.rir != null) return set.rir
  if (set.rpe != null) return rpeToRir(set.rpe)
  return null
}

/** Extract RPE from a custom set log, converting RIR to RPE if needed. */
export function logRpeValue(set: ExerciseLog['sets'][number]): number | null {
  if (set.rpe != null) return set.rpe
  if (set.rir != null) return rirToRpe(set.rir)
  return null
}

/** Extract RIR from a custom set log, converting RPE to RIR if needed. */
export function logRirValue(set: ExerciseLog['sets'][number]): number | null {
  if (set.rir != null) return set.rir
  if (set.rpe != null) return rpeToRir(set.rpe)
  return null
}

/** Average RPE across sets that have effort data. Returns null if no data. */
export function averageRpeFromBuiltinSets(sets: SetResultDraft[]): number | null {
  const rpes = sets.map(setRpeValue).filter((v): v is number => v != null)
  if (rpes.length === 0) return null
  return Math.round((rpes.reduce((s, v) => s + v, 0) / rpes.length) * 10) / 10
}

/** Average RIR across sets that have effort data. Returns null if no data. */
export function averageRirFromBuiltinSets(sets: SetResultDraft[]): number | null {
  const rirs = sets.map(setRirValue).filter((v): v is number => v != null)
  if (rirs.length === 0) return null
  return Math.round((rirs.reduce((s, v) => s + v, 0) / rirs.length) * 10) / 10
}

// ─── Analysis ────────────────────────────────────────────────────────────────

/**
 * Analyze a single completed builtin session and suggest progression.
 *
 * @param currentSets - Sets from the just-completed session
 * @param recentSessions - Previous completed sessions for the same program+day (most recent first)
 * @returns ProgressionSuggestion or null if no RPE/RIR data
 */
export function analyzeBuiltinProgression(
  currentSets: SetResultDraft[],
  recentSessions: SetResultDraft[][],
): ProgressionSuggestion | null {
  const avgRpe = averageRpeFromBuiltinSets(currentSets)
  const avgRir = averageRirFromBuiltinSets(currentSets)
  const setsWithEffort = currentSets.filter((s) => s.rpe != null || s.rir != null).length

  // No effort data → cannot suggest
  if (avgRpe === null && avgRir === null) return null

  // Any failed set → do not increase load
  const hasFailedSet = currentSets.some((s) => !s.passed)
  if (hasFailedSet) {
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainFailedSet',
      avgRpe,
      avgRir,
      setsWithEffort,
      confidence: 'high',
    }
  }

  // Check trend: were the last 2+ sessions also low RPE?
  const recentAvgRpes = recentSessions
    .slice(0, 2)
    .map((sets) => averageRpeFromBuiltinSets(sets))
    .filter((v): v is number => v != null)

  const sustainedLowRpe =
    recentAvgRpes.length >= 2 && recentAvgRpes.every((rpe) => rpe <= 7)

  const rpe = avgRpe ?? (avgRir != null ? rirToRpe(avgRir) : null)
  if (rpe === null) return null

  // RPE ≤ 6 (RIR ≥ 4): very easy → suggest increase only if sustained
  if (rpe <= 6) {
    if (sustainedLowRpe) {
      return {
        kind: 'increase_reps',
        reasonKey: 'progressionIncreaseReps',
        reasonParams: [rpe],
        delta: { reps: 1 },
        avgRpe,
        avgRir,
        setsWithEffort,
        confidence: 'high',
      }
    }
    // Not enough data — never increase based on a single session
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainObserve',
      reasonParams: [rpe],
      avgRpe,
      avgRir,
      setsWithEffort,
      confidence: 'medium',
    }
  }

  // RPE 7-8 (RIR 2-3): sweet spot → maintain
  if (rpe <= 8) {
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainSweetSpot',
      reasonParams: [rpe],
      avgRpe,
      avgRir,
      setsWithEffort,
      confidence: 'high',
    }
  }

  // RPE 9 (RIR 1): hard but OK → maintain, watch for deload
  if (rpe === 9) {
    // Check if RPE 9 sustained across 2+ previous sessions
    const sustainedHighRpe =
      recentAvgRpes.length >= 2 && recentAvgRpes.every((r) => r >= 9)
    if (sustainedHighRpe) {
      return {
        kind: 'reduce_volume',
        reasonKey: 'progressionReduceVolume',
        reasonParams: [rpe],
        delta: { volumePct: 20 },
        avgRpe,
        avgRir,
        setsWithEffort,
        confidence: 'high',
      }
    }
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainHard',
      reasonParams: [rpe],
      avgRpe,
      avgRir,
      setsWithEffort,
      confidence: 'high',
    }
  }

  // RPE 10 (RIR 0): max effort → deload only if sustained across 2+ sessions
  const sustainedMaxRpe =
    recentAvgRpes.length >= 2 && recentAvgRpes.every((r) => r >= 10)
  if (sustainedMaxRpe) {
    return {
      kind: 'deload',
      reasonKey: 'progressionDeload',
      reasonParams: [rpe],
      delta: { volumePct: 40 },
      avgRpe,
      avgRir,
      setsWithEffort,
      confidence: 'high',
    }
  }

  // RPE 10 but not sustained — maintain and observe, don't reduce based on 1 session
  return {
    kind: 'maintain',
    reasonKey: 'progressionMaintainMaxEffort',
    reasonParams: [rpe],
    avgRpe,
    avgRir,
    setsWithEffort,
    confidence: 'medium',
  }
}

/**
 * Analyze a single completed custom session and suggest progression.
 * Custom workouts can actually apply weight changes, so we distinguish
 * between reps_weight and bodyweight exercises.
 */
export function analyzeCustomProgression(
  currentLogs: ExerciseLog[],
  recentLogs: ExerciseLog[][],
): ProgressionSuggestion | null {
  // Flatten all sets across exercises
  const allSets = currentLogs.flatMap((log) => log.sets)
  const rpes = allSets.map(logRpeValue).filter((v): v is number => v != null)
  if (rpes.length === 0) return null

  const avgRpe = Math.round((rpes.reduce((s, v) => s + v, 0) / rpes.length) * 10) / 10
  // Compute avgRir from actual RIR values (converted from RPE where needed)
  const rirs = allSets.map(logRirValue).filter((v): v is number => v != null)
  const avgRir = rirs.length > 0
    ? Math.round((rirs.reduce((s, v) => s + v, 0) / rirs.length) * 10) / 10
    : null

  // Any failed set → do not increase
  const hasFailedSet = allSets.some((s) => !s.passed)
  if (hasFailedSet) {
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainFailedSet',
      avgRpe,
      avgRir,
      setsWithEffort: rpes.length,
      confidence: 'high',
    }
  }

  // Check if any exercise uses weight (reps_weight metric)
  const hasWeightedExercise = currentLogs.some((log) => {
    // We can't easily check the metric here without the exercise definition,
    // so we check if any set has weightKg > 0
    return log.sets.some((s) => (s.actual.weightKg ?? 0) > 0)
  })

  // Recent trend
  const recentAvgRpes = recentLogs
    .slice(0, 2)
    .map((logs) => {
      const sets = logs.flatMap((l) => l.sets)
      const rpes = sets.map(logRpeValue).filter((v): v is number => v != null)
      if (rpes.length === 0) return null
      return rpes.reduce((s, v) => s + v, 0) / rpes.length
    })
    .filter((v): v is number => v != null)

  const sustainedLowRpe = recentAvgRpes.length >= 2 && recentAvgRpes.every((r) => r <= 7)

  if (avgRpe <= 6) {
    if (sustainedLowRpe) {
      if (hasWeightedExercise) {
        return {
          kind: 'increase_weight',
          reasonKey: 'progressionIncreaseWeight',
          reasonParams: [avgRpe],
          delta: { weightKg: 2.5 },
          avgRpe,
          avgRir,
          setsWithEffort: rpes.length,
          confidence: 'high',
        }
      }
      return {
        kind: 'increase_reps',
        reasonKey: 'progressionIncreaseReps',
        reasonParams: [avgRpe],
        delta: { reps: 1 },
        avgRpe,
        avgRir,
        setsWithEffort: rpes.length,
        confidence: 'high',
      }
    }
    // Not enough data — never increase based on a single session
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainObserve',
      reasonParams: [avgRpe],
      avgRpe,
      avgRir,
      setsWithEffort: rpes.length,
      confidence: 'medium',
    }
  }

  if (avgRpe <= 8) {
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainSweetSpot',
      reasonParams: [avgRpe],
      avgRpe,
      avgRir,
      setsWithEffort: rpes.length,
      confidence: 'high',
    }
  }

  if (avgRpe === 9) {
    const sustainedHighRpe = recentAvgRpes.length >= 2 && recentAvgRpes.every((r) => r >= 9)
    if (sustainedHighRpe) {
      return {
        kind: 'reduce_volume',
        reasonKey: 'progressionReduceVolume',
        reasonParams: [avgRpe],
        delta: { volumePct: 20 },
        avgRpe,
        avgRir,
        setsWithEffort: rpes.length,
        confidence: 'high',
      }
    }
    return {
      kind: 'maintain',
      reasonKey: 'progressionMaintainHard',
      reasonParams: [avgRpe],
      avgRpe,
      avgRir,
      setsWithEffort: rpes.length,
      confidence: 'high',
    }
  }

  // RPE 10
  const sustainedMaxRpe = recentAvgRpes.length >= 2 && recentAvgRpes.every((r) => r >= 10)
  if (sustainedMaxRpe) {
    return {
      kind: 'deload',
      reasonKey: 'progressionDeload',
      reasonParams: [avgRpe],
      delta: { volumePct: 40 },
      avgRpe,
      avgRir,
      setsWithEffort: rpes.length,
      confidence: 'high',
    }
  }

  // RPE 10 but not sustained — maintain and observe
  return {
    kind: 'maintain',
    reasonKey: 'progressionMaintainMaxEffort',
    reasonParams: [avgRpe],
    avgRpe,
    avgRir,
    setsWithEffort: rpes.length,
    confidence: 'medium',
  }
}
