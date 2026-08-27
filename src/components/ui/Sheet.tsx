import { useEffect, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { pl } from '@/i18n/pl'

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  labelledBy?: string
}) {
  const trapRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[55] flex items-end justify-center bg-[var(--sr-bg-overlay)] safe-bottom"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-labelledby={labelledBy}
        className={cn(
          'max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-t-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] p-6 animate-sheet-in',
          className,
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          {title ? <h3 className="font-semibold">{title}</h3> : <span />}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 text-sm text-[var(--sr-text-muted)]"
            aria-label={pl.close}
          >
            {pl.close}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
