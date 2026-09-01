import { useEffect, useRef } from 'react'

let scrollLockCount = 0
let savedBodyOverflow = ''

function lockBodyScroll() {
  if (scrollLockCount === 0) {
    savedBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  scrollLockCount += 1
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1)
  if (scrollLockCount === 0) {
    document.body.style.overflow = savedBodyOverflow
    savedBodyOverflow = ''
  }
}

/** Safety release after immersive overlays (rest timer) — e.g. workout summary. */
export function releaseBodyScrollLock() {
  scrollLockCount = 0
  document.body.style.overflow = ''
  savedBodyOverflow = ''
}

export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active || !ref.current) return
    previousFocusRef.current = document.activeElement as HTMLElement | null
    const root = ref.current
    lockBodyScroll()

    const focusables = () =>
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )

    const list = focusables()
    list[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const nodes = focusables()
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    root.addEventListener('keydown', onKeyDown)
    return () => {
      root.removeEventListener('keydown', onKeyDown)
      unlockBodyScroll()
      previousFocusRef.current?.focus?.()
    }
  }, [active])

  return ref
}
