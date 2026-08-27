import { db, type LocalWorkoutSession } from '@/lib/db'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'
import { enqueueSync } from '@/lib/sync'
import { clearActiveWorkout, completeWorkoutDay } from '@/lib/program-service'

export async function saveWorkoutSession(session: LocalWorkoutSession): Promise<void> {
  await db.workoutSessions.put(session)
  await enqueueSync('workout_sessions', 'update', session)
}

export async function getLastPassedSession(
  program: Program,
  dayNumber: number,
  cycleAttempt: number,
): Promise<LocalWorkoutSession | undefined> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.passed === true &&
        s.dayNumber === dayNumber &&
        s.cycleAttempt === cycleAttempt,
    )
    .toArray()
  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  return sessions[0]
}

export async function getPreviousSetActual(
  program: Program,
  dayNumber: number,
  cycleAttempt: number,
  setNumber: number,
): Promise<number | undefined> {
  const session = await getLastPassedSession(program, dayNumber, cycleAttempt)
  return session?.setResults.find((r) => r.setNumber === setNumber)?.actual
}

export async function finalizeSuccessfulDay(
  session: LocalWorkoutSession,
  setResults: SetResultDraft[],
): Promise<void> {
  const existing = await db.workoutSessions.get(session.id)
  if (existing?.status === 'completed' && existing.passed === true) return

  const totalReps = setResults.reduce((s, r) => s + r.actual, 0)
  const updated: LocalWorkoutSession = {
    ...session,
    status: 'completed',
    completedAt: new Date().toISOString(),
    passed: true,
    totalReps,
    setResults,
  }
  await saveWorkoutSession(updated)
  await clearActiveWorkout(session.program)
  await completeWorkoutDay(session.program, true, totalReps)
}

export async function finalizeFailedDay(
  sessionId: string,
  program: Program,
  setResults: SetResultDraft[],
): Promise<void> {
  const existing = await db.workoutSessions.get(sessionId)
  if (!existing) return
  if (existing.status === 'completed' && existing.passed === false) return

  const totalReps = setResults.reduce((s, r) => s + r.actual, 0)
  const updated: LocalWorkoutSession = {
    ...existing,
    status: 'completed',
    completedAt: new Date().toISOString(),
    passed: false,
    totalReps,
    setResults,
  }
  await saveWorkoutSession(updated)
  await clearActiveWorkout(program)
  await completeWorkoutDay(program, false, totalReps)
}

export async function abandonWorkoutSession(program: Program, sessionId: string): Promise<void> {
  const existing = await db.workoutSessions.get(sessionId)
  if (existing && existing.status === 'in_progress') {
    await saveWorkoutSession({ ...existing, status: 'abandoned', completedAt: new Date().toISOString() })
  }
  await clearActiveWorkout(program)
}

export async function getSessionComparison(
  program: Program,
  sessionId: string,
): Promise<{ current: LocalWorkoutSession | undefined; previous: LocalWorkoutSession | undefined }> {
  const current = await db.workoutSessions.get(sessionId)
  if (!current) return { current: undefined, previous: undefined }
  const previous = await getLastPassedSession(program, current.dayNumber, current.cycleAttempt)
  if (previous?.id === current.id) {
    const all = await db.workoutSessions
      .where('program')
      .equals(program)
      .filter(
        (s) =>
          s.status === 'completed' &&
          s.passed === true &&
          s.dayNumber === current.dayNumber &&
          s.cycleAttempt === current.cycleAttempt &&
          s.id !== current.id,
      )
      .toArray()
    all.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    return { current, previous: all[0] }
  }
  return { current, previous }
}
