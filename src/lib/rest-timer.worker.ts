export type RestTimerWorkerIn =
  | { type: 'start'; totalSec: number; startedAt: number }
  | { type: 'add'; seconds: number }
  | { type: 'stop' }

export type RestTimerWorkerOut =
  | { type: 'tick'; remainingSec: number }
  | { type: 'complete' }

let activeInterval: ReturnType<typeof setInterval> | null = null
let activeTotalSec = 0
let activeStartedAt = 0

function clearActiveInterval() {
  if (activeInterval !== null) {
    clearInterval(activeInterval)
    activeInterval = null
  }
}

function startTicking() {
  clearActiveInterval()
  activeInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - activeStartedAt) / 1000)
    const remaining = Math.max(0, activeTotalSec - elapsed)
    self.postMessage({
      type: 'tick',
      remainingSec: remaining,
    } satisfies RestTimerWorkerOut)
    if (remaining <= 0) {
      clearActiveInterval()
      self.postMessage({
        type: 'complete',
      } satisfies RestTimerWorkerOut)
    }
  }, 200)
}

self.onmessage = (event: MessageEvent<RestTimerWorkerIn>) => {
  const data = event.data
  if (data.type === 'stop') {
    clearActiveInterval()
    return
  }

  if (data.type === 'add') {
    activeTotalSec += data.seconds
    return
  }

  if (data.type === 'start') {
    activeTotalSec = data.totalSec
    activeStartedAt = data.startedAt
    startTicking()
  }
}
