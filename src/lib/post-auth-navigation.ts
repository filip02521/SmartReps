import type { NavigateFunction } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import { drainIncompleteSetup } from '@/lib/setup-flow'

let authNavLock: Promise<void> | null = null

async function waitForHydration(timeoutMs = 3000): Promise<void> {
  if (useAppStore.persist.hasHydrated()) return
  await new Promise<void>((resolve) => {
    const done = () => resolve()
    const unsub = useAppStore.persist.onFinishHydration(() => {
      unsub()
      done()
    })
    window.setTimeout(() => {
      unsub()
      done()
    }, timeoutMs)
  })
}

/** Shared post-login / skip routing for setup gates (single-flight). */
export async function navigateAfterAuth(navigate: NavigateFunction): Promise<void> {
  if (authNavLock) return authNavLock

  authNavLock = (async () => {
    await waitForHydration()
    const { pendingStart, clearPendingStart } = useAppStore.getState()

    if (pendingStart) {
      const { program, navigateToWorkout } = pendingStart
      clearPendingStart()
      if (navigateToWorkout) {
        const prog = await getProgramProgress(program)
        const ready = !prog?.nextWorkoutAfter || isWorkoutAvailable(new Date(prog.nextWorkoutAfter))
        if (ready && prog?.status !== 'test_pending') {
          navigate(`/workout/${program}`, { replace: true })
          // Still try to surface incomplete other programs later via Dashboard
          return
        }
      }
      const drained = await drainIncompleteSetup(navigate)
      if (!drained) navigate('/', { replace: true })
      return
    }

    const drained = await drainIncompleteSetup(navigate)
    if (!drained) navigate('/', { replace: true })
  })().finally(() => {
    authNavLock = null
  })

  return authNavLock
}
