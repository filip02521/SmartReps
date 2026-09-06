const RELOAD_GUARD_KEY = 'sr-chunk-reload-count'
const MAX_RELOADS = 3

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
 * removed JS chunks. A few guarded reloads give the new SW time to activate.
 *
 * Anti-loop design:
 *  - Uses a reload COUNTER (not boolean) — allows up to MAX_RELOADS attempts.
 *  - The guard is NOT cleared on `load` — that was the old bug: `load` fired
 *    before chunk errors, clearing the guard and causing an infinite loop
 *    because the old SW was still serving stale HTML.
 *  - The guard is cleared after a grace period (5s) of error-free execution,
 *    so a genuinely fresh session starts with a clean slate.
 *  - After MAX_RELOADS, errors propagate to RouteErrorBoundary instead of
 *    reloading again.
 */
export function setupChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return

  const getReloadCount = () => {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY)
    return raw ? parseInt(raw, 10) : 0
  }

  const tryReload = () => {
    const count = getReloadCount()
    if (count >= MAX_RELOADS) return false
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(count + 1))
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

  // Clear the guard after 5 seconds of error-free execution.
  // This means: if the page loaded successfully and no chunk errors occurred
  // within 5s, the new SW is active and chunks are fresh — reset the counter
  // so a future deploy's first reload is allowed.
  window.addEventListener('load', () => {
    setTimeout(() => {
      sessionStorage.removeItem(RELOAD_GUARD_KEY)
    }, 5000)
  })
}

/** Lazy import wrapper — reload on chunk 404 (up to MAX_RELOADS), then surface
 *  the error to RouteErrorBoundary which shows a retry UI. */
export function lazyWithChunkRecovery<T extends { default: unknown }>(
  factory: () => Promise<T>,
): () => Promise<T> {
  return async () => {
    try {
      return await factory()
    } catch (err) {
      const count = sessionStorage.getItem(RELOAD_GUARD_KEY)
      const countNum = count ? parseInt(count, 10) : 0
      if (isChunkLoadError(err) && countNum < MAX_RELOADS) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(countNum + 1))
        window.location.reload()
        // Return a never-resolving promise — reload will replace the page
        return new Promise<T>(() => {})
      }
      throw err
    }
  }
}
