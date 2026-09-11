import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { trackError } from '@/lib/analytics'
import { pl } from '@/i18n/pl'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    trackError(error, info.componentStack?.slice(0, 80))
  }

  render() {
    if (this.state.error) {
      return (
        this.props.fallback ?? (
          <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-8 text-center safe-top safe-bottom">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--sr-error-muted)] text-[var(--sr-error)]"
              aria-hidden
            >
              <AlertTriangle size={32} strokeWidth={2} />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-[var(--sr-text-primary)]">
                {pl.errorCrash}
              </h2>
              <p className="text-sm leading-relaxed text-[var(--sr-text-secondary)]">
                {pl.errorCrashDesc}
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2">
              <Button
                type="button"
                size="touch"
                fullWidth
                onClick={() => window.location.reload()}
              >
                {pl.retry}
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                onClick={() => { window.location.href = '/' }}
              >
                {pl.backHome}
              </Button>
            </div>
          </div>
        )
      )
    }
    return this.props.children
  }
}
