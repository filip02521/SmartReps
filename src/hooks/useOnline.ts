import { useEffect, useState } from 'react'

export function useOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const offOnline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', offOnline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', offOnline)
    }
  }, [])

  return online
}
