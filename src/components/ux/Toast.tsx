import { cn } from '@/lib/utils'
import { useToastStore } from '@/stores/toast-store'
import { useWorkoutStore } from '@/stores/workout-store'
import { useLocation } from 'react-router-dom'
import { X } from 'lucide-react'
import { pl } from '@/i18n/pl'

const variantStyles = {
  success: 'border-[var(--sr-success)] bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
  info: 'border-[var(--sr-info)] bg-[var(--sr-info)]/10 text-[var(--sr-info)]',
  warning: 'border-[var(--sr-warning)] bg-[var(--sr-warning)]/15 text-[var(--sr-warning)]',
  error: 'border-[var(--sr-error)] bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)
  const immersive = useWorkoutStore((s) => s.immersive)
  const location = useLocation()
  const hideTabs =
    immersive || location.pathname.startsWith('/workout') || location.pathname.startsWith('/setup')

  if (toasts.length === 0) return null

  return (
    <div
      className={cn(
        'pointer-events-none fixed left-0 right-0 z-[90] mx-auto flex max-w-lg flex-col gap-2 px-4 safe-bottom',
        hideTabs ? 'bottom-4' : 'bottom-20',
      )}
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
            className="min-h-11 min-w-11 opacity-70"
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
