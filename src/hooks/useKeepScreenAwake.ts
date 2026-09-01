import { useEffect } from 'react'
import { requestWakeLock, releaseWakeLock } from '@/lib/rest-timer'

/** Keeps the screen awake for the whole active workout when enabled. */
export function useKeepScreenAwake(active: boolean): void {
  useEffect(() => {
    if (!active) {
      void releaseWakeLock()
      return
    }

    void requestWakeLock()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void requestWakeLock()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      void releaseWakeLock()
    }
  }, [active])
}
