import { cn } from '@/lib/utils'
import { useToastStore } from '@/stores/toast-store'
import { useWorkoutStore } from '@/stores/workout-store'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { pl } from '@/i18n/pl'
import {
  FOCUS_RING,
  TOAST_BOTTOM_NO_TABS,
  TOAST_BOTTOM_OVER_PILL,
  TOAST_BOTTOM_WITH_TABS,
  Z_TOAST,
} from '@/lib/ui-chrome'

const variantStyles = {
  success: 'border-[var(--sr-success)] bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
  info: 'border-[var(--sr-info)] bg-[var(--sr-info-muted)] text-[var(--sr-info)]',
  warning: 'border-[var(--sr-warning)] bg-[var(--sr-warning-muted)] text-[var(--sr-warning)]',
  error: 'border-[var(--sr-error)] bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const immersive = useWorkoutStore((s) => s.immersive)
  const restMode = useWorkoutStore((s) => s.restTimer?.mode ?? null)
  const location = useLocation()
  const hideTabs =
    immersive || location.pathname.startsWith('/workout') || location.pathname.startsWith('/setup')
  const pillVisible = hideTabs && restMode === 'pill'

  if (toasts.length === 0) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed left-0 right-0 mx-auto flex max-w-lg flex-col gap-2 px-4 safe-bottom',
        hideTabs
          ? pillVisible
            ? TOAST_BOTTOM_OVER_PILL
            : TOAST_BOTTOM_NO_TABS
          : TOAST_BOTTOM_WITH_TABS,
      )}
      style={{ zIndex: Z_TOAST }}
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center justify-between gap-3 rounded-[var(--sr-radius-md)] border px-4 py-3 text-sm shadow-[var(--sr-shadow-card)]',
            variantStyles[t.variant],
          )}
          role={t.variant === 'error' ? 'alert' : 'status'}
          aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
        >
          <span>{t.message}</span>
          <button
            type="button"
            className={cn('min-h-11 min-w-11 opacity-70', FOCUS_RING)}
            aria-label={pl.close}
            onClick={() => dismiss(t.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
