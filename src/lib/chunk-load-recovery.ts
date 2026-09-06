const RELOAD_GUARD_KEY = 'sr-chunk-reload-once'

/** Detect Vite / dynamic import failures after a new deployment.
 *  Matches specific error types and message patterns — avoids generic
 *  "load failed" which causes false positives on unrelated fetch failures. */
export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false
  // Check for TypeError from dynamic import — most reliable cross-browser signal
  if (err instanceof TypeError) {
    const msg = err.message.toLowerCase()
    if (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('importing a module script failed')
    ) {
      return true
    }
  }
  // Fallback: check message string for chunk-specific patterns
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return (
      msg.includes('failed to fetch dynamically imported module') ||
      msg.includes('error loading dynamically imported module') ||
      msg.includes('importing a module script failed') ||
      msg.includes('loading chunk')
    )
  }
  return false
}

/**
 * After deploy, an old service worker may serve stale index.html that references
 * removed JS chunks. One guarded reload usually fixes the session.
 */
export function setupChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return

  const tryReload = () => {
    if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return false
    sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
    window.location.reload()
    return true
  }

  window.addEventListener('unhandledrejection', (event) => {
    if (!isChunkLoadError(event.reason)) return
    // preventDefault BEFORE reload so the rejection doesn't surface as an error
    event.preventDefault()
    tryReload()
  })

  window.addEventListener('error', (event) => {
    if (!isChunkLoadError(event.error ?? event.message)) return
    tryReload()
  })

  window.addEventListener('load', () => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
  })
}

/** Lazy import wrapper — reload once on chunk 404, then surface the error.
 *  After reload, the guard prevents infinite loop; if reload already happened,
 *  the error propagates to RouteErrorBoundary which shows a retry UI. */
export function lazyWithChunkRecovery<T extends { default: unknown }>(
  factory: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    try {
      return await factory()
    } catch (err) {
      if (isChunkLoadError(err) && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1')
        window.location.reload()
        // Return a never-resolving promise — reload will replace the page
        return new Promise<T>(() => {})
      }
      throw err
    }
  }
}
