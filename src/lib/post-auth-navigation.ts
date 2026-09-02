import type { NavigateFunction } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import { drainIncompleteSetup, hasIncompleteSetup } from '@/lib/setup-flow'

let authNavLock: Promise<void> | null = null

export function isSafeReturnPath(path: string): boolean {
  if (!path.startsWith('/') || path.includes('//')) return false
  if (path.startsWith('/setup/')) return false
  const pathOnly = path.split('?')[0] ?? path
  if (pathOnly === '/') return true
  if (/^\/workout\/(pushups|pullups)(\/summary)?$/.test(pathOnly)) return true
  if (/^\/community\/[a-z0-9-]+$/.test(pathOnly)) return true
  const allowedRoots = ['/profile', '/progress', '/plans', '/workout/custom']
  return allowedRoots.some((root) => pathOnly === root || pathOnly.startsWith(`${root}/`))
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
  const { pendingStart, pendingCustomStart, clearPendingStart, clearPendingCustomStart, settings } =
    useAppStore.getState()
  const incomplete = await hasIncompleteSetup()

  if (
    returnTo &&
    isSafeReturnPath(returnTo) &&
    !pendingStart &&
    !pendingCustomStart &&
    !incomplete &&
    settings.onboardingComplete
  ) {
    navigate(returnTo, { replace: true })
    return
  }

  // Preserve community (and other) returnTo across onboarding / incomplete setup.
  if (returnTo && isSafeReturnPath(returnTo) && (!settings.onboardingComplete || incomplete)) {
    try {
      sessionStorage.setItem('auth-return-to', returnTo)
    } catch {
      // ignore
    }
  }

  if (pendingCustomStart) {
    const { customPlanId, navigateToWorkout } = pendingCustomStart
    clearPendingCustomStart()

    if (await hasIncompleteSetup()) {
      const drained = await drainIncompleteSetup(navigate)
      if (drained) return
    }

    if (navigateToWorkout) {
      navigate(`/workout/custom/${customPlanId}`, { replace: true })
      return
    }
    navigate('/plans?tab=mine', { replace: true })
    return
  }

  if (pendingStart) {
    const { program, navigateToWorkout } = pendingStart
    clearPendingStart()

    if (await hasIncompleteSetup()) {
      const drained = await drainIncompleteSetup(navigate)
      if (drained) return
    }

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
