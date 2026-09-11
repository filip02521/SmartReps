import { Component, type ReactNode } from 'react'
import { AlertTriangle, WifiOff } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { isChunkLoadError } from '@/lib/chunk-load-recovery'
import { Button } from '@/components/ui/Button'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  wasChunkError: boolean
  isOffline: boolean
}

/** Catches runtime errors from lazy-loaded routes and shows a retry UI
 *  instead of a blank screen. Without this, a runtime error in a lazy
 *  route (e.g. undefined import, bad data) crashes the whole app.
 *
 *  For chunk-load errors (stale SW after deploy), the retry button does a
 *  hard reload to force the new service worker to serve fresh chunks.
 *  If the device is offline, shows an offline message instead of looping
 *  reloads that can't succeed without network. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, wasChunkError: false, isOffline: false }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      wasChunkError: isChunkLoadError(error),
      isOffline: typeof navigator !== 'undefined' && !navigator.onLine,
    }
  }

  componentDidCatch(error: unknown) {
    console.error('[RouteErrorBoundary]', error)
  }

  handleRetry = () => {
    if (this.state.wasChunkError) {
      // Chunk errors need a hard reload — the stale SW must be bypassed.
      // Clear the reload guard so the new page can retry if needed.
      sessionStorage.removeItem('sr-chunk-reload-count')
      sessionStorage.removeItem('sr-chunk-reload-ts')
      window.location.reload()
      return
    }
    this.setState({ hasError: false, wasChunkError: false, isOffline: false })
  }

  handleHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      const isOfflineChunk = this.state.wasChunkError && this.state.isOffline
      const title = isOfflineChunk ? pl.errorOfflineTitle : pl.errorLoadPage
      const desc = isOfflineChunk ? pl.errorOfflineDesc : pl.errorLoadPageDesc
      const Icon = isOfflineChunk ? WifiOff : AlertTriangle
      return (
        <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-8 text-center safe-top safe-bottom">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sr-error-muted)] text-[var(--sr-error)]"
            aria-hidden
          >
            <Icon size={32} strokeWidth={2} />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-[var(--sr-text-primary)]">{title}</h2>
            <p className="text-sm leading-relaxed text-[var(--sr-text-secondary)]">{desc}</p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button type="button" size="touch" fullWidth onClick={this.handleRetry}>
              {pl.retry}
            </Button>
            <Button type="button" variant="ghost" fullWidth onClick={this.handleHome}>
              {pl.backHome}
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
