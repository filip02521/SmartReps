const RELOAD_GUARD_KEY = 'sr-chunk-reload-once'

/** Detect Vite / dynamic import failures after a new deployment. */
export function isChunkLoadError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const msg = err.message.toLowerCase()
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('loading chunk') ||
    msg.includes('load failed')
  )
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
    if (tryReload()) event.preventDefault()
  })

  window.addEventListener('error', (event) => {
    if (!isChunkLoadError(event.error ?? event.message)) return
    tryReload()
  })

  window.addEventListener('load', () => {
    sessionStorage.removeItem(RELOAD_GUARD_KEY)
  })
}

/** Lazy import wrapper — reload once on chunk 404, then surface the error. */
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
      }
      throw err
    }
  }
}
