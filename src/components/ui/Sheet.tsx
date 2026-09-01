import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { pl } from '@/i18n/pl'
import { FOCUS_RING, Z_SHEET } from '@/lib/ui-chrome'

/** Bottom inset for sheet panel — home indicator + comfortable thumb reach. */
const SHEET_PANEL_PADDING =
  'px-6 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]'

export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
  labelledBy,
  showClose = true,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  labelledBy?: string
  showClose?: boolean
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

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-[var(--sr-bg-overlay)]"
      style={{ zIndex: Z_SHEET }}
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
          'max-h-[min(80dvh,calc(100dvh-env(safe-area-inset-top,0px)-1rem))] w-full max-w-lg overflow-y-auto rounded-t-[var(--sr-radius-xl)] bg-[var(--sr-bg-elevated)] animate-sheet-in',
          SHEET_PANEL_PADDING,
          className,
        )}
      >
        {(title || showClose) && (
          <div className="mb-4 flex items-center justify-between gap-3">
            {title ? <h3 className="font-semibold">{title}</h3> : <span />}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'min-h-11 min-w-11 text-sm text-[var(--sr-text-muted)]',
                  FOCUS_RING,
                )}
                aria-label={pl.close}
              >
                {pl.close}
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
