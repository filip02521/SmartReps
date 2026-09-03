import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { pl } from '@/i18n/pl'
import { FOCUS_RING, Z_SHEET } from '@/lib/ui-chrome'
import { registerSheetEscape } from '@/lib/sheet-escape'

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
  elevated = false,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
  labelledBy?: string
  showClose?: boolean
  /** Stack above another open Sheet (e.g. ConfirmSheet). */
  elevated?: boolean
}) {
  const trapRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    return registerSheetEscape(onClose)
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 flex items-end justify-center bg-[var(--sr-bg-overlay)]"
      style={{ zIndex: elevated ? Z_SHEET + 5 : Z_SHEET }}
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
            {title ? <h3 className="font-semibold text-[var(--sr-text-primary)]">{title}</h3> : <span />}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  'flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
                  FOCUS_RING,
                )}
                aria-label={pl.close}
              >
                <X size={20} />
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
