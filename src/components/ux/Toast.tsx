import { cn } from '@/lib/utils'
import { useToastStore } from '@/stores/toast-store'
import { X } from 'lucide-react'

const variantStyles = {
  success: 'border-[var(--sr-success)] bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
  info: 'border-[var(--sr-info)] bg-[var(--sr-info)]/10 text-[var(--sr-info)]',
  warning: 'border-[var(--sr-warning)] bg-[var(--sr-warning)]/15 text-[var(--sr-warning)]',
  error: 'border-[var(--sr-error)] bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed bottom-20 left-0 right-0 z-[90] mx-auto flex max-w-lg flex-col gap-2 px-4 safe-bottom"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex items-center justify-between gap-3 rounded-[var(--sr-radius-md)] border px-4 py-3 text-sm shadow-[var(--sr-shadow-card)]',
            variantStyles[t.variant],
          )}
          role="status"
        >
          <span>{t.message}</span>
          <button
            type="button"
            className="opacity-70"
            aria-label="Zamknij"
            onClick={() => dismiss(t.id)}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
