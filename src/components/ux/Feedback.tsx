import { cn } from '@/lib/utils'
import { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { Z_OFFLINE } from '@/lib/ui-chrome'
import { NoticeCard, noticeIcon } from '@/components/ux/NoticeCard'

export { BrandLoader, PageLoader } from '@/components/ui/BrandLoader'

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
}: {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-14 text-center">
      {icon && (
        <div className="text-[var(--sr-brand-primary)] opacity-80" aria-hidden>
          {icon}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-[var(--sr-text-primary)]">{title}</h3>
        {description && (
          <p className="max-w-xs text-sm leading-relaxed text-[var(--sr-text-secondary)]">
            {description}
          </p>
        )}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-1 flex w-full max-w-xs flex-col gap-2">
          {action && <Button onClick={action.onClick}>{action.label}</Button>}
          {secondaryAction && (
            <Button variant="secondary" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

export function FeedbackBanner({
  variant = 'info',
  title,
  message,
  actionLabel,
  onAction,
  density = 'compact',
}: {
  variant?: 'info' | 'warning' | 'error' | 'success'
  title?: string
  message: string
  actionLabel?: string
  onAction?: () => void
  density?: 'default' | 'compact'
}) {
  return (
    <NoticeCard
      tone={variant}
      density={density}
      icon={noticeIcon(variant, density === 'compact' ? 16 : 20)}
      title={title}
      message={message}
      actionLabel={actionLabel}
      onAction={onAction}
    />
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert">
      <NoticeCard
        tone="error"
        icon={noticeIcon('error')}
        message={message}
        actionLabel={onRetry ? pl.tryAgain : undefined}
        onAction={onRetry}
      />
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
