const RELOAD_GUARD_KEY = 'sr-chunk-reload-count'
const RELOAD_GUARD_TS_KEY = 'sr-chunk-reload-ts'
const MAX_RELOADS = 3
// Guard expires after 10 minutes — a stale SW that hasn't updated by then is
// a different problem (no update available), so reset and let the user retry.
const GUARD_TTL_MS = 10 * 60 * 1000

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

/** Get the current reload count, expiring the guard if it's older than the TTL.
 *  Shared by setupChunkLoadRecovery and lazyWithChunkRecovery so both paths
 *  enforce the same lifetime cap. */
function getReloadCount(): number {
  const ts = sessionStorage.getItem(RELOAD_GUARD_TS_KEY)
  if (ts && Date.now() - parseInt(ts, 10) > GUARD_TTL_MS) {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
    sessionStorage.removeItem(RELOAD_GUARD_TS_KEY)
    return 0
  }
  const raw = sessionStorage.getItem(RELOAD_GUARD_KEY)
  return raw ? parseInt(raw, 10) : 0
}

/** Increment the reload counter, stamping the episode start on the first reload. */
function incrementReloadCount(): void {
  const count = getReloadCount()
  if (count === 0) {
    sessionStorage.setItem(RELOAD_GUARD_TS_KEY, String(Date.now()))
  }
  sessionStorage.setItem(RELOAD_GUARD_KEY, String(count + 1))
}

/**
 * After deploy, an old service worker may serve stale index.html that references
 * removed JS chunks. A few guarded reloads give the new SW time to activate.
 *
 * Anti-loop design:
 *  - Uses a reload COUNTER (not boolean) — allows up to MAX_RELOADS attempts.
 *  - The guard has a TTL (10 min) instead of a 5s grace period. The old 5s grace
 *    reset the counter too early: a slow device or a chunk error on a later
 *    navigation (not the initial load) would re-enter the reload cycle. With a
 *    TTL, the counter persists for the lifetime of a stale-SW episode and only
 *    resets once the SW has genuinely updated (or 10 min pass).
 *  - After MAX_RELOADS, errors propagate to RouteErrorBoundary instead of
 *    reloading again.
 */
export function setupChunkLoadRecovery(): void {
  if (typeof window === 'undefined') return

  const tryReload = () => {
    const count = getReloadCount()
    if (count >= MAX_RELOADS) return false
    incrementReloadCount()
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
      const count = getReloadCount()
      if (isChunkLoadError(err) && count < MAX_RELOADS) {
        incrementReloadCount()
        window.location.reload()
        // Return a never-resolving promise — reload will replace the page
        return new Promise<T>(() => {})
      }
      throw err
    }
  }
}
