import { useCallback, useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { RefreshCw, Sparkles, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackPwaUpdateReload } from '@/lib/analytics'
import { pl } from '@/i18n/pl'
import { FOCUS_RING, CHROME_BOTTOM_ABOVE_TABS, Z_TOAST } from '@/lib/ui-chrome'

const UPDATE_CHECK_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes
const UPDATE_CHANNEL = 'sr-sw-update'
const APPLY_TIMEOUT_MS = 8000 // safety: if SW doesn't activate, force reload

type UpdateState = 'idle' | 'available' | 'applying'

/** Shows a polished prompt when a new service worker is waiting (registerType: prompt).
 *  Detection improvements over the old implementation:
 *  - visibilitychange + periodic interval (kept)
 *  - `online` event — re-check when network returns
 *  - `controllerchange` — auto-reload when SW activates (e.g. from another tab)
 *  - BroadcastChannel — cross-tab notification when one tab detects an update
 *  - retry with backoff if reg.update() throws (transient network errors)
 *  UX improvements:
 *  - animated slide-up entrance
 *  - pulsing accent dot to draw attention
 *  - horizontal action layout (primary prominent, dismiss as icon)
 *  - "Applying..." state with spinner + auto-reload
 *  - touch-friendly button sizes
 *  - accessible: role="alert" aria-live="polite"
 */
export function PwaUpdatePrompt() {
  const [state, setState] = useState<UpdateState>('idle')
  const updateFnRef = useRef<(() => void) | null>(null)
  const applyTimerRef = useRef<number | undefined>(undefined)

  const applyUpdate = useCallback(() => {
    if (state === 'applying') return
    setState('applying')
    trackPwaUpdateReload()
    // Safety: if the SW doesn't activate within APPLY_TIMEOUT_MS, force a reload.
    // This handles edge cases where controllerchange never fires.
    applyTimerRef.current = window.setTimeout(() => {
      window.location.reload()
    }, APPLY_TIMEOUT_MS)
    updateFnRef.current?.()
  }, [state])

  useEffect(() => {
    if (!import.meta.env.PROD) return

    let registration: ServiceWorkerRegistration | undefined
    let retryDelay = 1000
    let retryTimer: number | undefined

    const updateSW = registerSW({
      onNeedRefresh() {
        setState('available')
        updateFnRef.current = () => updateSW
        // Notify other tabs so they can show the prompt too.
        try {
          const ch = new BroadcastChannel(UPDATE_CHANNEL)
          ch.postMessage('available')
          ch.close()
        } catch {
          // BroadcastChannel not supported (older browsers) — non-fatal
        }
      },
      onOfflineReady() {
        // app works offline after first load — no UI needed
      },
      onRegistered(reg) {
        registration = reg
        // Check for updates immediately after registration
        void reg?.update().catch(() => {
          // transient network error — schedule retry with backoff
          retryTimer = window.setTimeout(() => void reg?.update(), retryDelay)
          retryDelay = Math.min(retryDelay * 2, 30_000)
        })
      },
    })

    // Re-check when tab becomes visible (user returns to the app)
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        retryDelay = 1000
        void registration?.update().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    // Re-check when network comes back online
    const onOnline = () => {
      retryDelay = 1000
      void registration?.update().catch(() => {})
    }
    window.addEventListener('online', onOnline)

    // Periodic fallback — covers iOS Safari PWA where visibilitychange is unreliable
    const interval = window.setInterval(() => {
      void registration?.update().catch(() => {})
    }, UPDATE_CHECK_INTERVAL_MS)

    // Auto-reload when the controlling SW changes (e.g. another tab applied the update)
    const onControllerChange = () => {
      // Only reload if we're in the applying state or a new SW took over
      // unexpectedly — avoids reloading on first install.
      if (navigator.serviceWorker.controller) {
        window.clearTimeout(applyTimerRef.current)
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)

    // Cross-tab: if another tab detects an update, show the prompt here too
    let channel: BroadcastChannel | undefined
    try {
      channel = new BroadcastChannel(UPDATE_CHANNEL)
      channel.onmessage = (ev) => {
        if (ev.data === 'available') {
          setState('available')
          // Also trigger a local update check so we have the updateFn
          void registration?.update().catch(() => {})
        }
      }
    } catch {
      // BroadcastChannel not supported — non-fatal
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
      window.clearInterval(interval)
      window.clearTimeout(retryTimer)
      window.clearTimeout(applyTimerRef.current)
      channel?.close()
      updateFnRef.current = null
    }
  }, [])

  if (state === 'idle') return null

  const applying = state === 'applying'

  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 mx-auto max-w-lg px-4',
        CHROME_BOTTOM_ABOVE_TABS,
      )}
      style={{ zIndex: Z_TOAST }}
      role="alert"
      aria-live="polite"
    >
      <div
        className={cn(
          'sr-update-in pointer-events-auto relative overflow-hidden',
          'rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-strong)]',
          'bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]',
        )}
        style={{
          backgroundImage: `linear-gradient(135deg,
            color-mix(in srgb, var(--sr-brand-primary) 16%, var(--sr-bg-elevated)) 0%,
            color-mix(in srgb, var(--sr-brand-secondary) 8%, var(--sr-bg-elevated)) 50%,
            var(--sr-bg-elevated) 100%)`,
        }}
      >
        {/* Accent strip */}
        <div
          className="absolute inset-x-0 top-0 h-0.5"
          style={{
            background:
              'linear-gradient(90deg, var(--sr-brand-primary), var(--sr-brand-secondary))',
          }}
          aria-hidden
        />

        <div className="flex items-center gap-3 p-3.5">
          {/* Icon with pulsing accent dot */}
          <div className="relative shrink-0">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-[var(--sr-radius-md)]"
              style={{
                background: 'var(--sr-brand-primary-muted)',
                color: 'var(--sr-brand-primary)',
              }}
              aria-hidden
            >
              {applying ? (
                <RefreshCw size={22} className="sr-update-spin" />
              ) : (
                <Sparkles size={22} />
              )}
            </div>
            {!applying && (
              <span
                className="sr-update-pulse absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full"
                style={{
                  background: 'var(--sr-success)',
                  boxShadow: '0 0 6px var(--sr-success)',
                }}
                aria-hidden
              />
            )}
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug text-[var(--sr-text-primary)]">
              {applying ? pl.pwaUpdateApplying : pl.pwaUpdateTitle}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--sr-text-secondary)]">
              {applying ? pl.pwaUpdateApplyingHint : pl.pwaUpdateBody}
            </p>
          </div>

          {/* Actions */}
          {!applying && (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={applyUpdate}
                className={cn(
                  'flex min-h-11 items-center gap-1.5 rounded-[var(--sr-radius-md)] px-4',
                  'bg-[var(--sr-brand-primary)] text-sm font-semibold text-white',
                  'transition-transform active:scale-95 hover:brightness-110',
                  FOCUS_RING,
                )}
              >
                <RefreshCw size={16} />
                <span className="whitespace-nowrap">{pl.pwaUpdateReload}</span>
              </button>
              <button
                type="button"
                aria-label={pl.pwaUpdateLater}
                onClick={() => setState('idle')}
                className={cn(
                  'flex min-h-11 min-w-11 items-center justify-center',
                  'rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)]',
                  'transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)]',
                  FOCUS_RING,
                )}
              >
                <X size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
