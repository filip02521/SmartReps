import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('SmartReps error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="mx-auto max-w-lg p-6 safe-top">
            <ErrorBanner
              message={pl.errorCrash}
              onRetry={() => window.location.reload()}
            />
          </div>
        )
      )
    }
    return this.props.children
  }
}
