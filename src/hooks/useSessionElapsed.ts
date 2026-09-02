import { useEffect, useState } from 'react'
import { sessionWallClockSec } from '@/lib/session-elapsed'

/** Live wall-clock seconds since `startedAt` (ISO). Updates every second. */
export function useSessionElapsed(startedAt: string | null | undefined): number {
  const [elapsedSec, setElapsedSec] = useState(() =>
    startedAt ? sessionWallClockSec(startedAt) : 0,
  )

  useEffect(() => {
    if (!startedAt) {
      setElapsedSec(0)
      return
    }
    const tick = () => setElapsedSec(sessionWallClockSec(startedAt))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [startedAt])

  return elapsedSec
}
