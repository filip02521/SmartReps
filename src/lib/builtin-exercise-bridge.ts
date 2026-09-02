import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog, SetLog } from '@/lib/exercise-model'
import { setTargetToMetricTarget } from '@/lib/exercise-model'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { pl } from '@/i18n/pl'

/** Builtin Strong programs that share starter library exercises. */
export const BUILTIN_LIBRARY_PROGRAMS = ['pushups', 'pullups'] as const
export type BuiltinLibraryProgram = (typeof BUILTIN_LIBRARY_PROGRAMS)[number]

function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Starter / program labels that map a library exercise to a builtin program. */
const PROGRAM_NAME_ALIASES: Record<BuiltinLibraryProgram, string[]> = {
  pushups: [pl.exerciseStarterPushups, pl.pushupsProgram],
  pullups: [pl.exerciseStarterPullups, pl.pullupsProgram],
}

const PROGRAM_ALIAS_LOOKUP = new Map<string, BuiltinLibraryProgram>()
for (const program of BUILTIN_LIBRARY_PROGRAMS) {
  for (const label of PROGRAM_NAME_ALIASES[program]) {
    PROGRAM_ALIAS_LOOKUP.set(normalizeExerciseName(label), program)
  }
}

export function isBuiltinLibraryProgram(program: string): program is BuiltinLibraryProgram {
  return (BUILTIN_LIBRARY_PROGRAMS as readonly string[]).includes(program)
}

/**
 * Library „Pompki” / „Podciąganie” (starter names) ↔ Strong pushups/pullups.
 * Match is name + reps metric — user renames break the link intentionally.
 */
export function resolveBuiltinProgramForExercise(
  exercise: Pick<ExerciseDefinition, 'name' | 'primaryMetric'>,
): BuiltinLibraryProgram | null {
  if (exercise.primaryMetric !== 'reps') return null
  return PROGRAM_ALIAS_LOOKUP.get(normalizeExerciseName(exercise.name)) ?? null
}

export function builtinProgramLabel(program: BuiltinLibraryProgram): string {
  return program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
}

export function isCompletedBuiltinProgramSession(
  session: LocalWorkoutSession,
): session is LocalWorkoutSession & { program: BuiltinLibraryProgram } {
  if (session.status !== 'completed') return false
  if (isCustomWorkoutSession(session)) return false
  return isBuiltinLibraryProgram(session.program)
}

/** Convert Strong `setResults` into a synthetic custom exercise log for stats. */
export function builtinSessionToExerciseLog(
  session: LocalWorkoutSession,
  exerciseId: string,
): ExerciseLog | null {
  if (!session.setResults?.length) return null
  const sets: SetLog[] = session.setResults.map((sr) => ({
    setNumber: sr.setNumber,
    passed: sr.passed,
    actual: { reps: sr.actual },
    prescription: { reps: setTargetToMetricTarget(sr.target) },
  }))
  return {
    exerciseId,
    order: 0,
    sets,
  }
}
