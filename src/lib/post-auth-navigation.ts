import type { NavigateFunction } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import { drainIncompleteSetup, hasIncompleteSetup } from '@/lib/setup-flow'

let authNavLock: Promise<void> | null = null

export function isSafeReturnPath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('//')) return false
  if (path.startsWith('/setup/')) return false
  if (path === '/') return true
  const allowedRoots = ['/profile', '/progress', '/plans']
  return allowedRoots.some((root) => path === root || path.startsWith(`${root}/`))
}

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
async function executeAuthNavigation(
  navigate: NavigateFunction,
  returnTo?: string | null,
): Promise<void> {
  await waitForHydration()
  const { pendingStart, clearPendingStart, settings } = useAppStore.getState()
  const incomplete = await hasIncompleteSetup()

  if (
    returnTo &&
    isSafeReturnPath(returnTo) &&
    !pendingStart &&
    !incomplete &&
    settings.onboardingComplete
  ) {
    navigate(returnTo, { replace: true })
    return
  }

  if (pendingStart) {
    const { program, navigateToWorkout } = pendingStart
    clearPendingStart()
    if (navigateToWorkout) {
      const prog = await getProgramProgress(program)
      const ready = !prog?.nextWorkoutAfter || isWorkoutAvailable(new Date(prog.nextWorkoutAfter))
      if (ready && prog?.status !== 'test_pending') {
        navigate(`/workout/${program}`, { replace: true })
        return
      }
    }
    const drained = await drainIncompleteSetup(navigate)
    if (!drained) navigate('/', { replace: true })
    return
  }

  const drained = await drainIncompleteSetup(navigate)
  if (!drained) navigate('/', { replace: true })
}

export async function navigateAfterAuth(navigate: NavigateFunction): Promise<void> {
  if (authNavLock) return authNavLock

  authNavLock = executeAuthNavigation(navigate).finally(() => {
    authNavLock = null
  })

  return authNavLock
}

/** After login: honor explicit returnTo when setup is complete, else drain setup gates. */
export async function resolvePostAuthNavigation(
  navigate: NavigateFunction,
  returnTo?: string | null,
): Promise<void> {
  if (authNavLock) return authNavLock

  authNavLock = executeAuthNavigation(navigate, returnTo).finally(() => {
    authNavLock = null
  })

  return authNavLock
}
