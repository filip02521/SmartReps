import type { NavigateFunction } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress, getActiveWorkout } from '@/lib/program-service'
import { abandonWorkoutSession } from '@/lib/session-service'
import { db } from '@/lib/db'
import type { Program } from '@/data/plans/types'

export function isProgram(value: string | undefined | null): value is Program {
  return value === 'pushups' || value === 'pullups'
}

let setupDrainLock: Promise<boolean> | null = null

/**
 * Navigate to the first enabled program that still needs setup.
 * Returns true if a navigation was issued.
 */
export async function drainIncompleteSetup(navigate: NavigateFunction): Promise<boolean> {
  if (setupDrainLock) return setupDrainLock

  setupDrainLock = (async () => {
    const enabled = useAppStore.getState().settings.enabledPrograms
    for (const program of enabled) {
      const prog = await getProgramProgress(program)
      if (!prog) {
        const queue = useAppStore.getState().setupQueue.filter((p) => p !== program)
        useAppStore.getState().setSetupQueue(queue)
        navigate(`/setup/test/${program}`, { replace: true })
        return true
      }
    }
    if (useAppStore.getState().setupQueue.length > 0) {
      useAppStore.getState().setSetupQueue([])
    }
    return false
  })().finally(() => {
    setupDrainLock = null
  })

  return setupDrainLock
}

/** Abandon any in-progress session + clear active before level change / retest. */
export async function beginProgramSetup(
  navigate: NavigateFunction,
  program: Program,
  opts?: { retest?: boolean; replace?: boolean },
): Promise<void> {
  const active = await getActiveWorkout(program)
  if (active) {
    await abandonWorkoutSession(program, active.sessionId)
  } else {
    const orphan = await db.workoutSessions
      .where('program')
      .equals(program)
      .filter((s) => s.status === 'in_progress')
      .first()
    if (orphan) await abandonWorkoutSession(program, orphan.id)
  }
  const q = opts?.retest ? '?retest=1' : ''
  navigate(`/setup/test/${program}${q}`, { replace: opts?.replace })
}
