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
    // Dedup: if an identical toast (same message + variant + action label)
    // is already visible, don't add a duplicate. This prevents the user from
    // seeing 2+ "session expired" toasts stacked on top of each other.
    const actionLabel = opts?.action?.label
    const existing = get().toasts.find(
      (t) =>
        t.message === message &&
        t.variant === variant &&
        (t.action?.label ?? null) === (actionLabel ?? null),
    )
    if (existing) return

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
