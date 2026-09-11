/**
 * RPE/RIR trend aggregation for the Progress page.
 *
 * Aggregates per-session average RPE/RIR across completed sessions,
 * grouped by exercise (custom) or program+day (builtin).
 */

import { db } from '@/lib/db'
import type { ExerciseLog } from '@/lib/exercise-model'
import { rpeToRir, rirToRpe } from '@/lib/exercise-model'
import { setRpeValue, setRirValue } from '@/lib/rpe-analysis'
import { pl } from '@/i18n/pl'

// ─── Types ───────────────────────────────────────────────────────────────────

export type RpeTrendPoint = {
  /** ISO date string (YYYY-MM-DD) */
  date: string
  /** Display label for the session (e.g. "Pushups D1", "Bench Press") */
  sessionLabel: string
  /** Average RPE across sets with effort data (null if no data) */
  avgRpe: number | null
  /** Average RIR across sets with effort data (null if no data) */
  avgRir: number | null
  /** Number of sets with RPE/RIR data */
  setCount: number
  /** Session ID for linking to session details */
  sessionId: string
}

export type RpeTrendGroup = {
  /** Exercise ID (custom) or program+day key (builtin) */
  key: string
  /** Display name for the group */
  label: string
  /** Trend points, oldest first */
  points: RpeTrendPoint[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sessionDateLabel(iso: string): string {
  return iso.split('T')[0] ?? iso
}

function builtinSessionLabel(program: string, dayNumber: number): string {
  const programLabel =
    program === 'pushups' ? pl.pushupsProgram
      : program === 'pullups' ? pl.pullupsProgram
      : program === 'squats' ? pl.squatsProgram
      : program
  return `${programLabel} D${dayNumber}`
}

function customSessionLabel(
  log: ExerciseLog,
  exerciseMap: Map<string, { name?: string }>,
): string {
  const def = exerciseMap.get(log.exerciseId)
  return def?.name ?? pl.exerciseFallbackName
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

/**
 * Get RPE/RIR trend for a builtin program (pushups/pullups/squats).
 * Returns one group per day number, with points sorted oldest-first.
 */
export async function getBuiltinRpeTrend(
  program: string,
  limit = 10,
): Promise<RpeTrendGroup[]> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed')
    .toArray()

  // Group by dayNumber
  const byDay = new Map<number, RpeTrendPoint[]>()
  for (const session of sessions) {
    const sets = session.setResults ?? []
    const rpes = sets.map(setRpeValue).filter((v): v is number => v != null)
    if (rpes.length === 0) continue

    const avgRpe = Math.round((rpes.reduce((s, v) => s + v, 0) / rpes.length) * 10) / 10
    const rirs = sets.map(setRirValue).filter((v): v is number => v != null)
    const avgRir =
      rirs.length > 0
        ? Math.round((rirs.reduce((s, v) => s + v, 0) / rirs.length) * 10) / 10
        : null

    const dayNumber = session.dayNumber
    const points = byDay.get(dayNumber) ?? []
    points.push({
      date: sessionDateLabel(session.startedAt),
      sessionLabel: builtinSessionLabel(program, dayNumber),
      avgRpe,
      avgRir,
      setCount: rpes.length,
      sessionId: session.id,
    })
    byDay.set(dayNumber, points)
  }

  // Build groups, sort points oldest-first, limit to last N
  const groups: RpeTrendGroup[] = []
  for (const [dayNumber, points] of byDay.entries()) {
    const sorted = points.sort((a, b) => a.date.localeCompare(b.date))
    const limited = sorted.slice(-limit)
    groups.push({
      key: `${program}-d${dayNumber}`,
      label: builtinSessionLabel(program, dayNumber),
      points: limited,
    })
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Get RPE/RIR trend for a custom plan, grouped by exercise.
 */
export async function getCustomRpeTrend(
  customPlanId: string,
  exerciseMap: Map<string, { name?: string }>,
  limit = 10,
): Promise<RpeTrendGroup[]> {
  const sessions = await db.workoutSessions
    .filter((s) => s.customPlanId === customPlanId && s.status === 'completed')
    .toArray()

  // Flatten all sets across all sessions, grouped by exerciseId
  const byExercise = new Map<string, RpeTrendPoint[]>()
  for (const session of sessions) {
    const logs = session.exerciseLogs ?? []
    for (const log of logs) {
      const rpes = log.sets
        .map((s) => (s.rpe != null ? s.rpe : s.rir != null ? rirToRpe(s.rir) : null))
        .filter((v): v is number => v != null)
      if (rpes.length === 0) continue

      const avgRpe = Math.round((rpes.reduce((s, v) => s + v, 0) / rpes.length) * 10) / 10
      const rirs = log.sets
        .map((s) => (s.rir != null ? s.rir : s.rpe != null ? rpeToRir(s.rpe) : null))
        .filter((v): v is number => v != null)
      const avgRir =
        rirs.length > 0
          ? Math.round((rirs.reduce((s, v) => s + v, 0) / rirs.length) * 10) / 10
          : null

      const points = byExercise.get(log.exerciseId) ?? []
      points.push({
        date: sessionDateLabel(session.startedAt),
        sessionLabel: customSessionLabel(log, exerciseMap),
        avgRpe,
        avgRir,
        setCount: rpes.length,
        sessionId: session.id,
      })
      byExercise.set(log.exerciseId, points)
    }
  }

  const groups: RpeTrendGroup[] = []
  for (const [exerciseId, points] of byExercise.entries()) {
    const sorted = points.sort((a, b) => a.date.localeCompare(b.date))
    const limited = sorted.slice(-limit)
    const def = exerciseMap.get(exerciseId)
    groups.push({
      key: exerciseId,
      label: def?.name ?? pl.exerciseFallbackName,
      points: limited,
    })
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Check if any completed sessions have RPE/RIR data.
 * Used to show empty state in the trend panel.
 */
export async function hasAnyRpeData(): Promise<boolean> {
  const sessions = await db.workoutSessions
    .filter((s) => s.status === 'completed')
    .toArray()
  for (const session of sessions) {
    // Builtin
    if (session.setResults?.some((s) => s.rpe != null || s.rir != null)) return true
    // Custom
    if (session.exerciseLogs?.some((log) => log.sets.some((s) => s.rpe != null || s.rir != null))) {
      return true
    }
  }
  return false
}
