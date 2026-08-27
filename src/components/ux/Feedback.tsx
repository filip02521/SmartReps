import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { Z_OFFLINE } from '@/lib/ui-chrome'

export { BrandLoader, PageLoader } from '@/components/ui/BrandLoader'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
      {icon && <div className="text-[var(--sr-brand-primary)]">{icon}</div>}
      <h3 className="text-lg font-semibold text-[var(--sr-text-primary)]">{title}</h3>
      {description && (
        <p className="max-w-xs text-sm text-[var(--sr-text-secondary)]">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  )
}

export function FeedbackBanner({
  variant = 'info',
  message,
  actionLabel,
  onAction,
}: {
  variant?: 'info' | 'warning' | 'error' | 'success'
  message: string
  actionLabel?: string
  onAction?: () => void
}) {
  const styles = {
    info: 'border-[var(--sr-info)] bg-[var(--sr-info)]/10 text-[var(--sr-info)]',
    warning: 'border-[var(--sr-warning)] bg-[var(--sr-warning)]/15 text-[var(--sr-warning)]',
    error: 'border-[var(--sr-error)] bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
    success: 'border-[var(--sr-success)] bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
  }[variant]

  return (
    <div className={cn('rounded-[var(--sr-radius-md)] border p-4', styles)}>
      <p className="text-sm">{message}</p>
      {actionLabel && onAction && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-error)] bg-[var(--sr-error-muted)] p-4">
      <p className="text-sm text-[var(--sr-error)]">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={onRetry}>
          {pl.tryAgain}
        </Button>
      )}
    </div>
  )
}

export function OfflineBar() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 top-0 bg-[var(--sr-warning)]/20 px-4 py-2 text-center text-xs font-medium text-[var(--sr-warning)] safe-top"
      style={{ zIndex: Z_OFFLINE }}
    >
      {pl.offline}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative h-32 overflow-hidden rounded-[var(--sr-radius-lg)] bg-[var(--sr-bg-surface)]',
        className,
      )}
      aria-hidden
    >
      <div className="absolute inset-0 sr-skeleton-shimmer" />
    </div>
  )
}

export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            i <= current ? 'bg-[var(--sr-brand-primary)]' : 'bg-[var(--sr-bg-surface)]',
          )}
        />
      ))}
    </div>
  )
}
