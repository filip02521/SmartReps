export type RestTimerMode = 'idle' | 'pill' | 'expanded'

export type RestTimerState = {
  mode: RestTimerMode
  totalSec: number
  remainingSec: number
  startedAt: number | null
}

export function createRestTimer(
  totalSec: number,
  mode: RestTimerMode = 'pill',
): RestTimerState {
  const safeTotal = Math.max(0, Math.floor(totalSec))
  return {
    mode,
    totalSec: safeTotal,
    remainingSec: safeTotal,
    startedAt: Date.now(),
  }
}

export function tickRestTimer(state: RestTimerState): RestTimerState {
  if (!state.startedAt || state.mode === 'idle') return state
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000)
  const remaining = Math.max(0, state.totalSec - elapsed)
  return { ...state, remainingSec: remaining }
}

export function isRestComplete(state: RestTimerState): boolean {
  return state.remainingSec <= 0 && state.mode !== 'idle'
}

export function addRestTime(state: RestTimerState, seconds: number): RestTimerState {
  return {
    ...state,
    totalSec: state.totalSec + seconds,
    remainingSec: state.remainingSec + seconds,
  }
}

export function skipRest(): RestTimerState {
  stopRestTimerWorker()
  return { mode: 'idle', totalSec: 0, remainingSec: 0, startedAt: null }
}

let wakeLock: WakeLockSentinel | null = null
let worker: Worker | null = null
let workerIntervalFallback: number | null = null

type WorkerCallbacks = {
  onTick: (remainingSec: number) => void
  onComplete: () => void
  getState: () => RestTimerState | null
}

let callbacks: WorkerCallbacks | null = null

export function startRestTimerWorker(state: RestTimerState, cb: WorkerCallbacks): void {
  stopRestTimerWorker()
  callbacks = cb

  if (!state.startedAt || state.mode === 'idle') return

  try {
    worker = new Worker(new URL('./rest-timer.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ type: string; remainingSec?: number }>) => {
      if (event.data.type === 'tick' && event.data.remainingSec !== undefined) {
        callbacks?.onTick(event.data.remainingSec)
      }
      if (event.data.type === 'complete') {
        callbacks?.onComplete()
        stopRestTimerWorker()
      }
    }
    worker.postMessage({
      type: 'start',
      totalSec: state.totalSec,
      startedAt: state.startedAt,
    })
  } catch {
    workerIntervalFallback = window.setInterval(() => {
      const current = callbacks?.getState()
      if (!current) return
      const updated = tickRestTimer(current)
      callbacks?.onTick(updated.remainingSec)
      if (isRestComplete(updated)) {
        callbacks?.onComplete()
        stopRestTimerWorker()
      }
    }, 200)
  }
}

export function stopRestTimerWorker(): void {
  if (worker) {
    worker.postMessage({ type: 'stop' })
    worker.terminate()
    worker = null
  }
  if (workerIntervalFallback !== null) {
    clearInterval(workerIntervalFallback)
    workerIntervalFallback = null
  }
}

export async function requestWakeLock() {
  try {
    if (!('wakeLock' in navigator)) return
    if (wakeLock && !wakeLock.released) return
    wakeLock = await navigator.wakeLock.request('screen')
  } catch {
    // not supported or denied
  }
}

export async function releaseWakeLock() {
  try {
    await wakeLock?.release()
    wakeLock = null
  } catch {
    // ignore
  }
}
