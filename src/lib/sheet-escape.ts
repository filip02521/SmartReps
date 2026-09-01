/** LIFO Escape handlers for stacked Sheets — only the topmost closes. */
const escapeStack: Array<() => void> = []

let listening = false

function onKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || escapeStack.length === 0) return
  e.preventDefault()
  e.stopPropagation()
  escapeStack[escapeStack.length - 1]!()
}

function ensureListener() {
  if (listening || typeof window === 'undefined') return
  window.addEventListener('keydown', onKeyDown, true)
  listening = true
}

export function registerSheetEscape(onClose: () => void): () => void {
  ensureListener()
  escapeStack.push(onClose)
  return () => {
    const idx = escapeStack.lastIndexOf(onClose)
    if (idx >= 0) escapeStack.splice(idx, 1)
  }
}
