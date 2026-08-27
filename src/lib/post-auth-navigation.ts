import type { NavigateFunction } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'

let authNavLock: Promise<void> | null = null

/** Shared post-login / skip routing for setup gates (single-flight). */
export async function navigateAfterAuth(navigate: NavigateFunction): Promise<void> {
  if (authNavLock) return authNavLock

  authNavLock = (async () => {
    const { pendingStart, clearPendingStart } = useAppStore.getState()

    if (pendingStart) {
      const { program, navigateToWorkout } = pendingStart
      clearPendingStart()
      if (navigateToWorkout) {
        const prog = await getProgramProgress(program)
        const ready = !prog?.nextWorkoutAfter || isWorkoutAvailable(new Date(prog.nextWorkoutAfter))
        if (ready && prog?.status !== 'test_pending') {
          navigate(`/workout/${program}`)
          return
        }
      }
      navigate('/')
      return
    }

    // Drain already-configured programs; stop at first that still needs setup.
    while (true) {
      const { setupQueue, shiftSetupQueue } = useAppStore.getState()
      const next = setupQueue[0]
      if (!next) break
      const prog = await getProgramProgress(next)
      shiftSetupQueue()
      if (!prog) {
        navigate(`/setup/test/${next}`)
        return
      }
    }

    navigate('/')
  })().finally(() => {
    authNavLock = null
  })

  return authNavLock
}
