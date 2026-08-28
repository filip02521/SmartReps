import { create } from 'zustand'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

export type ToastAction = {
  label: string
  onClick: () => void
}

export type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
  action?: ToastAction
}

type ToastPushOptions = {
  action?: ToastAction
  /** Override auto-dismiss ms (default depends on variant). */
  durationMs?: number
}

type ToastStore = {
  toasts: ToastItem[]
  push: (message: string, variant?: ToastVariant, opts?: ToastPushOptions) => void
  dismiss: (id: string) => void
}

const DURATION: Record<ToastVariant, number> = {
  success: 3500,
  info: 3500,
  warning: 4500,
  error: 5000,
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, variant = 'success', opts) => {
    const existing = get().toasts.find(
      (t) => t.message === message && t.variant === variant && !t.action && !opts?.action,
    )
    if (existing && !opts?.action) return

    const id = crypto.randomUUID()
    set({
      toasts: [
        ...get().toasts,
        { id, message, variant, action: opts?.action },
      ],
    })
    const duration = opts?.durationMs ?? (opts?.action ? Math.max(DURATION[variant], 10000) : DURATION[variant])
    window.setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    }, duration)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export function showToast(
  message: string,
  variant?: ToastVariant,
  opts?: ToastPushOptions,
) {
  useToastStore.getState().push(message, variant, opts)
}
