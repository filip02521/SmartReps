import { useEffect } from 'react'
import { setKeepAwake } from '@/lib/keep-awake'

/** Keeps the screen awake for the whole active workout when enabled. */
export function useKeepScreenAwake(active: boolean): void {
  useEffect(() => {
    setKeepAwake(active)
    return () => setKeepAwake(false)
  }, [active])
}
