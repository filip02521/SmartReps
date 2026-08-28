import { db } from '@/lib/db'
import { useAppStore } from '@/stores/app-store'

export type AccountSwitchPending = {
  userId: string
}

let pending: AccountSwitchPending | null = null
let listeners: Array<(p: AccountSwitchPending | null) => void> = []

function notify() {
  for (const fn of listeners) fn(pending)
}

export function subscribeAccountSwitchPending(
  fn: (p: AccountSwitchPending | null) => void,
): () => void {
  listeners.push(fn)
  fn(pending)
  return () => {
    listeners = listeners.filter((l) => l !== fn)
  }
}

export function getAccountSwitchPending(): AccountSwitchPending | null {
  return pending
}

export function setAccountSwitchPending(p: AccountSwitchPending | null): void {
  pending = p
  notify()
}

/** True when logging into a different account while local Dexie has progress. */
export async function needsAccountSwitchConfirm(userId: string): Promise<boolean> {
  const { lastAuthUserId } = useAppStore.getState()
  if (!lastAuthUserId || lastAuthUserId === userId) return false
  const progressCount = await db.programProgress.count()
  return progressCount > 0
}

export function clearAccountSwitchPending(): void {
  setAccountSwitchPending(null)
}
