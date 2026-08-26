import { useEffect, useRef } from 'react'

export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !ref.current) return
    const root = ref.current
    const focusables = root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || focusables.length === 0) return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    root.addEventListener('keydown', onKeyDown)
    return () => root.removeEventListener('keydown', onKeyDown)
  }, [active])

  return ref
}
