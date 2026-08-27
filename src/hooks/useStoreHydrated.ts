import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'

/** True after zustand persist has rehydrated from localStorage. */
export function useStoreHydrated() {
  const [hydrated, setHydrated] = useState(() => useAppStore.persist.hasHydrated())

  useEffect(() => {
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    return useAppStore.persist.onFinishHydration(() => setHydrated(true))
  }, [])

  return hydrated
}
