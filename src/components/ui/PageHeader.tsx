import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  subtitle,
  onBack,
  action,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex items-start gap-3">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className={cn(
            'mt-0.5 flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
            FOCUS_RING,
          )}
          aria-label={pl.back}
        >
          <ArrowLeft size={22} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="sr-text-h1">{title}</h1>
        {subtitle && (
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0 pt-0.5">{action}</div>}
    </header>
  )
}
