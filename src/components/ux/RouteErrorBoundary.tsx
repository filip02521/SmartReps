import { Component, type ReactNode } from 'react'
import { pl } from '@/i18n/pl'
import { isChunkLoadError } from '@/lib/chunk-load-recovery'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
  wasChunkError: boolean
}

/** Catches runtime errors from lazy-loaded routes and shows a retry UI
 *  instead of a blank screen. Without this, a runtime error in a lazy
 *  route (e.g. undefined import, bad data) crashes the whole app.
 *
 *  For chunk-load errors (stale SW after deploy), the retry button does a
 *  hard reload to force the new service worker to serve fresh chunks. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, wasChunkError: false }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, wasChunkError: isChunkLoadError(error) }
  }

  componentDidCatch(error: unknown) {
    console.error('[RouteErrorBoundary]', error)
  }

  handleRetry = () => {
    if (this.state.wasChunkError) {
      // Chunk errors need a hard reload — the stale SW must be bypassed.
      // Clear the reload guard so the new page can retry if needed.
      sessionStorage.removeItem('sr-chunk-reload-count')
      window.location.reload()
      return
    }
    this.setState({ hasError: false, wasChunkError: false })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="sr-text-body text-[var(--sr-text)]">{pl.errorLoadPage}</p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="sr-btn sr-btn-primary"
          >
            {pl.retry}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
