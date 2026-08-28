import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { clearAllLocalData } from '@/lib/local-data'
import { signOutUser } from '@/lib/auth-lifecycle'
import {
  runAuthenticatedSync,
  peekAuthReturnTo,
  setAuthReturnTo,
  consumeAuthReturnTo,
} from '@/lib/auth-sync'
import { resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
import {
  clearAccountSwitchPending,
  subscribeAccountSwitchPending,
  type AccountSwitchPending,
} from '@/lib/account-switch-gate'
import { useAppStore } from '@/stores/app-store'
import { pl } from '@/i18n/pl'
import { track } from '@/lib/analytics'
import { showToast } from '@/stores/toast-store'

export function AccountSwitchGate() {
  const navigate = useNavigate()
  const [pending, setPending] = useState<AccountSwitchPending | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => subscribeAccountSwitchPending(setPending), [])

  if (!pending) return null

  const loginReturnTo = (): string => {
    const stored = peekAuthReturnTo()
    if (stored) return stored
    const path = window.location.pathname + window.location.search
    return path.startsWith('/setup/') ? '/' : path
  }

  const goToLogin = () => {
    const returnTo = loginReturnTo()
    setAuthReturnTo(returnTo)
    navigate(`/setup/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true })
  }

  const handleClear = async () => {
    if (busy) return
    setBusy(true)
    try {
      track('account_switch_cleared')
      await clearAllLocalData()
      useAppStore.setState({ lastAuthUserId: pending.userId })
      clearAccountSwitchPending()
      await runAuthenticatedSync({ showSuccessToast: true, showFailureToast: true })
      await resolvePostAuthNavigation(navigate, consumeAuthReturnTo())
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (busy) return
    setBusy(true)
    try {
      track('account_switch_cancelled')
      clearAccountSwitchPending()
      await signOutUser()
      goToLogin()
    } finally {
      setBusy(false)
    }
  }

  const handleWrongAccount = async () => {
    if (busy) return
    setBusy(true)
    try {
      track('account_switch_wrong_account')
      clearAccountSwitchPending()
      await signOutUser()
      showToast(pl.accountSwitchWrongAccountToast, 'info')
      goToLogin()
    } finally {
      setBusy(false)
    }
  }

  return (
    <ConfirmSheet
      title={pl.accountSwitchConfirmTitle}
      message={pl.accountSwitchConfirmMessage}
      confirmLabel={pl.accountSwitchClearLocal}
      cancelLabel={pl.accountSwitchCancel}
      variant="danger"
      onConfirm={() => void handleClear()}
      onCancel={() => void handleCancel()}
      extraActions={
        <Button variant="secondary" fullWidth onClick={() => void handleWrongAccount()} disabled={busy}>
          {pl.accountSwitchWrongAccount}
        </Button>
      }
    />
  )
}
