import type { ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Download,
  LogIn,
  X,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { pl } from '@/i18n/pl'

export type NoticeTone = 'info' | 'warning' | 'error' | 'success' | 'brand' | 'neutral'

const toneAccent: Record<NoticeTone, string> = {
  info: 'var(--sr-info)',
  warning: 'var(--sr-warning)',
  error: 'var(--sr-error)',
  success: 'var(--sr-success)',
  brand: 'var(--sr-brand-primary)',
  neutral: 'var(--sr-border-strong)',
}

const toneMuted: Record<NoticeTone, string> = {
  info: 'var(--sr-info-muted)',
  warning: 'var(--sr-warning-muted)',
  error: 'var(--sr-error-muted)',
  success: 'var(--sr-success-muted)',
  brand: 'var(--sr-brand-primary-muted)',
  neutral: 'var(--sr-bg-surface)',
}

/** Elevated notice / tip / coach card with icon + hierarchy. */
export function NoticeCard({
  tone = 'info',
  icon,
  title,
  message,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  /** When true (InstallCoach under a card primary), action stays secondary. */
  demotePrimary = true,
  /** Stack full-width actions (coach / tips). */
  stackActions = false,
  /** Compact density for in-card banners. */
  density = 'default',
  className,
  children,
}: {
  tone?: NoticeTone
  icon?: ReactNode
  title?: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  dismissLabel?: string
  onDismiss?: () => void
  demotePrimary?: boolean
  stackActions?: boolean
  density?: 'default' | 'compact'
  className?: string
  children?: ReactNode
}) {
  const accent = toneAccent[tone]
  const compact = density === 'compact'
  const showCornerDismiss = Boolean(onDismiss && !dismissLabel)
  const actionVariant = demotePrimary ? 'secondary' : 'primary'

  return (
    <div
      className={cn(
        'relative overflow-hidden border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]',
        compact
          ? 'rounded-[var(--sr-radius-md)] p-3'
          : 'rounded-[var(--sr-radius-lg)] p-4',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(
          135deg,
          color-mix(in srgb, ${accent} ${compact ? 10 : 14}%, var(--sr-bg-elevated)) 0%,
          var(--sr-bg-elevated) 55%
        )`,
      }}
    >
      <div className={cn('flex', compact ? 'gap-2.5' : 'gap-3')}>
        <div
          className={cn(
            'shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
            compact ? 'mt-0.5 flex h-8 w-8' : 'mt-0.5 flex h-10 w-10',
          )}
          style={{ background: toneMuted[tone], color: accent }}
          aria-hidden
        >
          {icon}
        </div>
        <div className={cn('min-w-0 flex-1', showCornerDismiss && 'pr-8')}>
          {title && (
            <p
              className={cn(
                'font-semibold leading-snug text-[var(--sr-text-primary)]',
                compact && 'text-sm',
              )}
            >
              {title}
            </p>
          )}
          {message && (
            <p
              className={cn(
                'leading-relaxed text-[var(--sr-text-secondary)]',
                compact ? 'text-sm' : 'sr-text-body-sm',
                title && (compact ? 'mt-0.5' : 'mt-1'),
              )}
            >
              {message}
            </p>
          )}
          {children}
          {(actionLabel && onAction) || (dismissLabel && onDismiss) ? (
            <div
              className={cn(
                compact ? 'mt-2' : 'mt-3',
                stackActions ? 'flex flex-col gap-2' : 'flex flex-wrap gap-2',
              )}
            >
              {actionLabel && onAction && (
                <Button
                  size={stackActions ? 'md' : 'sm'}
                  fullWidth={stackActions}
                  variant={actionVariant}
                  onClick={onAction}
                >
                  {actionLabel}
                </Button>
              )}
              {dismissLabel && onDismiss && (
                <Button
                  size={stackActions ? 'md' : 'sm'}
                  fullWidth={stackActions}
                  variant="ghost"
                  onClick={onDismiss}
                >
                  {dismissLabel}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
      {showCornerDismiss && (
        <button
          type="button"
          aria-label={pl.close}
          className={cn(
            'absolute right-1.5 top-1.5 flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)]',
            FOCUS_RING,
          )}
          onClick={onDismiss}
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}

export function noticeIcon(tone: NoticeTone, size = 20): ReactNode {
  const props = { size, strokeWidth: 2.25 as const }
  switch (tone) {
    case 'success':
      return <CheckCircle2 {...props} />
    case 'warning':
      return <AlertTriangle {...props} />
    case 'error':
      return <XCircle {...props} />
    case 'brand':
      return <Download {...props} />
    case 'neutral':
      return <Lightbulb {...props} />
    default:
      return <Info {...props} />
  }
}

export { LogIn, Lightbulb, CheckCircle2, AlertTriangle, Info, Download }
