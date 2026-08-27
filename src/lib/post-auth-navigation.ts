import type { NavigateFunction } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'

/** Shared post-login / skip routing for setup gates. */
export async function navigateAfterAuth(navigate: NavigateFunction): Promise<void> {
  const { setupQueue, shiftSetupQueue, pendingStart, clearPendingStart } = useAppStore.getState()

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

  const next = setupQueue[0]
  if (next) {
    const prog = await getProgramProgress(next)
    shiftSetupQueue()
    if (!prog) {
      navigate(`/setup/test/${next}`)
      return
    }
  }
  navigate('/')
}
