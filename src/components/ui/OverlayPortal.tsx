import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

/** Full-screen overlays that must paint above tab bar / main stacking context. */
export function OverlayPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
