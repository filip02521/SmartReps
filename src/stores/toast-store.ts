import { create } from 'zustand'

export type ToastVariant = 'success' | 'info' | 'warning' | 'error'

export type ToastItem = {
  id: string
  message: string
  variant: ToastVariant
}

type ToastStore = {
  toasts: ToastItem[]
  push: (message: string, variant?: ToastVariant) => void
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
  push: (message, variant = 'success') => {
    const existing = get().toasts.find((t) => t.message === message && t.variant === variant)
    if (existing) return
    const id = crypto.randomUUID()
    set({ toasts: [...get().toasts, { id, message, variant }] })
    window.setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    }, DURATION[variant])
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export function showToast(message: string, variant?: ToastVariant) {
  useToastStore.getState().push(message, variant)
}
