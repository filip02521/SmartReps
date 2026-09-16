/**
 * Keep-screen-awake during workouts.
 *
 * Strategy:
 *  1. Screen Wake Lock API (`navigator.wakeLock`) — the real thing on Chrome /
 *     Android / desktop / iOS Safari ≥16.4.
 *  2. NoSleep-style fallback — a looping muted inline <video> keeps iOS awake
 *     where the Wake Lock API is missing or rejects (older iOS, some standalone
 *     PWA contexts, low-power edge cases).
 *
 * Robustness handled here (callers just flip a boolean):
 *  - Re-acquire after the system releases the sentinel (release event),
 *    on visibilitychange back to visible, and on pageshow (iOS standalone
 *    doesn't reliably fire visibilitychange on unlock).
 *  - Async race guard: a request resolving after release no longer leaks a
 *    live lock that keeps the screen on forever.
 */

let sentinel: WakeLockSentinel | null = null
let fallbackVideo: HTMLVideoElement | null = null

/** Single source of truth — what the caller wants right now. */
let wantAwake = false
/** Guards the request/release race: bumped on every intent change. */
let generation = 0
let listenersInstalled = false

function onReacquireSignal() {
  if (wantAwake && document.visibilityState === 'visible') {
    void acquire()
  }
}

function installListeners() {
  if (listenersInstalled) return
  listenersInstalled = true
  document.addEventListener('visibilitychange', onReacquireSignal)
  window.addEventListener('pageshow', onReacquireSignal)
}

function removeListeners() {
  if (!listenersInstalled) return
  listenersInstalled = false
  document.removeEventListener('visibilitychange', onReacquireSignal)
  window.removeEventListener('pageshow', onReacquireSignal)
}

// ── NoSleep video fallback (iOS without Wake Lock) ──

function startFallbackVideo() {
  if (fallbackVideo) {
    void fallbackVideo.play().catch(() => {})
    return
  }
  const v = document.createElement('video')
  v.muted = true
  v.loop = true
  v.playsInline = true
  v.setAttribute('playsinline', '')
  v.setAttribute('webkit-playsinline', '')
  v.src = '/keep-awake.mp4'
  v.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:-10px;top:-10px'
  document.body.appendChild(v)
  fallbackVideo = v
  void v.play().catch(() => {})
}

function stopFallbackVideo() {
  if (!fallbackVideo) return
  fallbackVideo.pause()
  fallbackVideo.remove()
  fallbackVideo = null
}

// ── Wake Lock ──

async function acquire(): Promise<void> {
  const gen = generation

  if ('wakeLock' in navigator) {
    if (sentinel && !sentinel.released) return
    if (document.visibilityState !== 'visible') return // request would be rejected anyway
    try {
      const s = await navigator.wakeLock.request('screen')
      // Intent changed (or effect cleaned up) while the request was in flight —
      // don't leak a live lock.
      if (gen !== generation || !wantAwake) {
        void s.release().catch(() => {})
        return
      }
      sentinel = s
      // A real lock superseded the video fallback — stop decoding it.
      stopFallbackVideo()
      s.addEventListener('release', () => {
        if (sentinel === s) sentinel = null
        // System released the lock (battery saver, screen off) — re-acquire
        // next time the page is visible if the workout still wants it.
        onReacquireSignal()
      })
      return
    } catch {
      // NotAllowedError (hidden tab, permissions policy) or unsupported —
      // fall through to the video fallback so iOS standalone still works.
    }
  }
  if (wantAwake && gen === generation) startFallbackVideo()
}

async function release(): Promise<void> {
  const s = sentinel
  sentinel = null
  stopFallbackVideo()
  if (s && !s.released) {
    try {
      await s.release()
    } catch {
      // already released by the system
    }
  }
}

/**
 * Request/release the screen-awake lock. Idempotent — call as often as the
 * condition changes; listeners are installed lazily while the lock is wanted.
 */
export function setKeepAwake(on: boolean): void {
  wantAwake = on
  generation += 1
  if (on) {
    installListeners()
    void acquire()
  } else {
    removeListeners()
    void release()
  }
}
