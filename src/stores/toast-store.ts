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

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, variant = 'success') => {
    const id = crypto.randomUUID()
    set({ toasts: [...get().toasts, { id, message, variant }] })
    window.setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    }, 2000)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export function showToast(message: string, variant?: ToastVariant) {
  useToastStore.getState().push(message, variant)
}
