import type { NavigateFunction } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { abandonAllInProgress } from '@/lib/session-service'
import { track } from '@/lib/analytics'
import type { Program } from '@/data/plans/types'

export function isProgram(value: string | undefined | null): value is Program {
  return value === 'pushups' || value === 'pullups'
}

let setupDrainLock: Promise<boolean> | null = null

/**
 * True only for an active setup chain (pending test/start or queued program
 * still without progress). Unconfigured enabled programs alone are NOT incomplete —
 * soft onboarding leaves them on home until the user taps the card.
 */
export async function hasIncompleteSetup(): Promise<boolean> {
  const { pendingTest, pendingStart, setupQueue } = useAppStore.getState()
  if (pendingTest || pendingStart) return true
  for (const program of setupQueue) {
    if (!(await getProgramProgress(program))) return true
  }
  return false
}

/**
 * Continue an active setup chain only.
 * Returns true if a navigation was issued.
 */
export async function drainIncompleteSetup(navigate: NavigateFunction): Promise<boolean> {
  if (setupDrainLock) return setupDrainLock

  setupDrainLock = (async () => {
    const state = useAppStore.getState()

    if (state.pendingTest) {
      // pendingTest is set only after a completed max test → resume cycle picker
      const program = state.pendingTest.program
      navigate(`/setup/cycle/${program}`, { replace: true })
      return true
    }

    const queue = state.setupQueue
    for (const program of queue) {
      const prog = await getProgramProgress(program)
      if (!prog) {
        const stillNeeded = queue.filter((p) => p !== program)
        useAppStore.getState().setSetupQueue(stillNeeded)
        navigate(`/setup/test/${program}`, { replace: true })
        return true
      }
    }

    if (queue.length > 0) {
      useAppStore.getState().setSetupQueue([])
    }
    return false
  })().finally(() => {
    setupDrainLock = null
  })

  return setupDrainLock
}

/** Progress empty CTA / deep links — same guards as Dashboard. */
export async function navigateToTrain(
  navigate: NavigateFunction,
  program: Program,
): Promise<void> {
  const prog = await getProgramProgress(program)
  if (!prog) {
    navigate(`/setup/test/${program}`)
    return
  }
  if (prog.status === 'test_pending') {
    await beginProgramSetup(navigate, program, { retest: true })
    return
  }
  // Let Workout show rest gate / resume; do not force-start from Progress
  navigate(`/workout/${program}`)
}

/** Abandon any in-progress session + clear active before level change / retest. */
export async function beginProgramSetup(
  navigate: NavigateFunction,
  program: Program,
  opts?: { retest?: boolean; replace?: boolean },
): Promise<void> {
  await abandonAllInProgress(program)
  if (opts?.retest) {
    track('retest_start', { program })
  }
  const q = opts?.retest ? '?retest=1' : ''
  navigate(`/setup/test/${program}${q}`, { replace: opts?.replace ?? true })
}

/**
 * Change cycle/range without a max test — for users who already know the target level.
 * Retest remains available via beginProgramSetup({ retest: true }).
 */
export async function beginLevelChange(
  navigate: NavigateFunction,
  program: Program,
  opts?: { replace?: boolean },
): Promise<void> {
  await abandonAllInProgress(program)
  useAppStore.getState().clearPendingTest()
  track('level_change', { program })
  navigate(`/setup/cycle/${program}?change=1`, { replace: opts?.replace ?? true })
}
