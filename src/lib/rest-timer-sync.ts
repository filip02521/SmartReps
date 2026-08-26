import { tickRestTimer, type RestTimerState } from '@/lib/rest-timer'

export function reconcileRestTimerJson(json: string | null | undefined): string | null {
  if (!json) return null
  try {
    const state = JSON.parse(json) as RestTimerState
    if (state.mode === 'idle' || state.startedAt == null) return null
    const ticked = tickRestTimer(state)
    if (ticked.remainingSec <= 0) return null
    return JSON.stringify(ticked)
  } catch {
    return null
  }
}

/** Legacy rows that only stored rest_started_at (no duration). Best-effort 120s cap. */
export function legacyRestTimerFromStartedAt(startedAtIso: string): string | null {
  const startedAt = new Date(startedAtIso).getTime()
  const elapsed = Math.floor((Date.now() - startedAt) / 1000)
  const totalSec = 120
  const remainingSec = totalSec - elapsed
  if (remainingSec <= 0) return null
  return JSON.stringify({
    mode: 'pill',
    totalSec,
    remainingSec,
    startedAt,
  } satisfies RestTimerState)
}
