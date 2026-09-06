import { Component, type ReactNode } from 'react'
import { pl } from '@/i18n/pl'

type Props = {
  children: ReactNode
}

type State = {
  hasError: boolean
}

/** Catches runtime errors from lazy-loaded routes and shows a retry UI
 *  instead of a blank screen. Without this, a runtime error in a lazy
 *  route (e.g. undefined import, bad data) crashes the whole app. */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[RouteErrorBoundary]', error)
  }

  handleRetry = () => {
    this.setState({ hasError: false })
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
