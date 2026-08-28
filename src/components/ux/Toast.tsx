import { cn } from '@/lib/utils'
import { useToastStore, type ToastVariant } from '@/stores/toast-store'
import { useWorkoutStore } from '@/stores/workout-store'
import { useLocation } from 'react-router-dom'
import { CheckCircle2, Info, AlertTriangle, XCircle, Cloud, X } from 'lucide-react'
import { pl } from '@/i18n/pl'
import {
  FOCUS_RING,
  TOAST_BOTTOM_NO_TABS,
  TOAST_BOTTOM_OVER_PILL,
  TOAST_BOTTOM_WITH_TABS,
  Z_TOAST,
} from '@/lib/ui-chrome'
import type { ReactNode } from 'react'

const variantChrome: Record<
  ToastVariant,
  { accent: string; muted: string; icon: ReactNode }
> = {
  success: {
    accent: 'var(--sr-success)',
    muted: 'var(--sr-success-muted)',
    icon: <CheckCircle2 size={18} strokeWidth={2.25} />,
  },
  info: {
    accent: 'var(--sr-info)',
    muted: 'var(--sr-info-muted)',
    icon: <Info size={18} strokeWidth={2.25} />,
  },
  warning: {
    accent: 'var(--sr-warning)',
    muted: 'var(--sr-warning-muted)',
    icon: <AlertTriangle size={18} strokeWidth={2.25} />,
  },
  error: {
    accent: 'var(--sr-error)',
    muted: 'var(--sr-error-muted)',
    icon: <XCircle size={18} strokeWidth={2.25} />,
  },
}

function toastIcon(variant: ToastVariant, message: string): ReactNode {
  if (variant === 'success' && /synchroniz/i.test(message)) {
    return <Cloud size={18} strokeWidth={2.25} />
  }
  return variantChrome[variant].icon
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
      {toasts.map((t) => {
        const chrome = variantChrome[t.variant]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-3.5 py-3 shadow-[var(--sr-shadow-card)] animate-toast-in',
            )}
            style={{
              backgroundImage: `linear-gradient(
                135deg,
                color-mix(in srgb, ${chrome.accent} 12%, var(--sr-bg-elevated)) 0%,
                var(--sr-bg-elevated) 55%
              )`,
            }}
            role={t.variant === 'error' ? 'alert' : 'status'}
            aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
          >
            <div
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
              style={{ background: chrome.muted, color: chrome.accent }}
              aria-hidden
            >
              {toastIcon(t.variant, t.message)}
            </div>
            <p className="min-w-0 flex-1 pt-1.5 text-sm font-medium leading-snug text-[var(--sr-text-primary)]">
              {t.message}
            </p>
            <button
              type="button"
              className={cn(
                'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-muted)] hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)]',
                FOCUS_RING,
              )}
              aria-label={pl.close}
              onClick={() => dismiss(t.id)}
            >
              <X size={16} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
