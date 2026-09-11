import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore, showToast } from '@/stores/toast-store'

describe('toast-store dedup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear all toasts
    useToastStore.setState({ toasts: [] })
  })

  it('dedups identical toasts without action', () => {
    const { push } = useToastStore.getState()
    push('Test message', 'info')
    push('Test message', 'info')
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('does not dedup toasts with different messages', () => {
    const { push } = useToastStore.getState()
    push('Message A', 'info')
    push('Message B', 'info')
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('does not dedup toasts with different variants', () => {
    const { push } = useToastStore.getState()
    push('Test message', 'info')
    push('Test message', 'warning')
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('dedups toasts with same action label', () => {
    const { push } = useToastStore.getState()
    const action = { label: 'Login', onClick: () => undefined }
    push('Session expired', 'warning', { action })
    push('Session expired', 'warning', { action })
    expect(useToastStore.getState().toasts).toHaveLength(1)
  })

  it('does not dedup toasts with different action labels', () => {
    const { push } = useToastStore.getState()
    push('Session expired', 'warning', {
      action: { label: 'Login', onClick: () => undefined },
    })
    push('Session expired', 'warning', {
      action: { label: 'Retry', onClick: () => undefined },
    })
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('dedups toast with action vs without action (same message+variant)', () => {
    const { push } = useToastStore.getState()
    push('Session expired', 'warning', {
      action: { label: 'Login', onClick: () => undefined },
    })
    push('Session expired', 'warning')
    // Different action labels (one has 'Login', other has null) — should NOT dedup
    expect(useToastStore.getState().toasts).toHaveLength(2)
  })

  it('showToast helper pushes to store', () => {
    showToast('Hello', 'success')
    expect(useToastStore.getState().toasts).toHaveLength(1)
    expect(useToastStore.getState().toasts[0].message).toBe('Hello')
  })

  it('dismiss removes a toast by id', () => {
    const { push, dismiss } = useToastStore.getState()
    push('Test', 'info')
    const id = useToastStore.getState().toasts[0].id
    dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
