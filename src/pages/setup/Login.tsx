import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageLoader } from '@/components/ux/Feedback'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { isSafeReturnPath, resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
import {
  consumeAuthReturnTo,
  peekAuthReturnTo,
  runAuthenticatedSync,
  setAuthReturnTo,
} from '@/lib/auth-sync'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'

type LoginLocationState = { returnTo?: string }

function readReturnTo(
  state: LoginLocationState | null,
  search: string,
): string | null {
  const fromState = state?.returnTo
  if (fromState && isSafeReturnPath(fromState)) return fromState
  const fromQuery = new URLSearchParams(search).get('returnTo')
  if (fromQuery && isSafeReturnPath(fromQuery)) return fromQuery
  return null
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const hydrated = useStoreHydrated()
  const returnTo = readReturnTo(location.state as LoginLocationState | null, location.search)

  useEffect(() => {
    if (returnTo) setAuthReturnTo(returnTo)
  }, [returnTo])

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured) return

    void supabase.auth.getSession().then(({ data }) => {
      setSignedInEmail(data.session?.user.email ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setSignedInEmail(null)
        setSent(false)
        return
      }
      if (session?.user.email) {
        setSignedInEmail(session.user.email)
      }
    })

    return () => subscription.unsubscribe()
  }, [hydrated])

  const effectiveReturnTo = () => returnTo ?? peekAuthReturnTo()

  const continueSignedIn = async () => {
    setLoading(true)
    await runAuthenticatedSync({ showSuccessToast: true, showFailureToast: true })
    await resolvePostAuthNavigation(navigate, effectiveReturnTo() ?? consumeAuthReturnTo())
    setLoading(false)
  }

  const logoutToSwitch = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setSignedInEmail(null)
    setSent(false)
    setEmail('')
    setLoading(false)
    showToast(pl.loginLogoutToSwitchDone, 'info')
  }

  const skip = async () => {
    await resolvePostAuthNavigation(navigate, effectiveReturnTo() ?? consumeAuthReturnTo())
  }

  const sendLink = async () => {
    if (!isSupabaseConfigured) {
      await skip()
      return
    }
    if (signedInEmail) {
      showToast(pl.loginLogoutToSwitchHint, 'error')
      return
    }
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast(pl.loginInvalidEmail, 'error')
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    const backPath = effectiveReturnTo()
    if (backPath) params.set('returnTo', backPath)
    const query = params.toString()
    const redirectTo = `${window.location.origin}/setup/login${query ? `?${query}` : ''}`
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo },
    })
    setLoading(false)
    if (error) {
      showToast(error.message || pl.errorSendLink, 'error')
      return
    }
    setSent(true)
  }

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader />
      </div>
    )
  }

  if (signedInEmail && !sent) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <SetupStepper current="login" />
        <PageHeader title={pl.loginTitle} subtitle={pl.loginSubtitle} />
        <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">
          {pl.loginAlreadySignedIn}{' '}
          <span className="font-medium text-[var(--sr-text-primary)]">{signedInEmail}</span>
        </p>
        <Button className="mt-4" fullWidth disabled={loading} onClick={() => void continueSignedIn()}>
          {pl.loginContinue}
        </Button>
        <Button
          variant="ghost"
          className="mt-2"
          fullWidth
          disabled={loading}
          onClick={() => void logoutToSwitch()}
        >
          {pl.loginLogoutToSwitch}
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <SetupStepper current="login" />
      <PageHeader title={pl.loginTitle} subtitle={pl.loginSubtitle} />

      {sent ? (
        <div className="mt-2 space-y-3">
          <p className="text-[var(--sr-success)]">{pl.loginSent}</p>
          <p className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3 text-sm text-[var(--sr-text-secondary)]">
            {pl.loginPwaHint}
          </p>
        </div>
      ) : (
        <>
          <label htmlFor="login-email" className="mt-2 block text-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.loginEmailLabel}
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder={pl.loginEmailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-[var(--sr-text-primary)]"
          />
          <Button className="mt-4" fullWidth disabled={loading || !email.trim()} onClick={() => void sendLink()}>
            {pl.loginSendLink}
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-[var(--sr-text-muted)]">{pl.loginPwaHint}</p>
        </>
      )}

      <Button variant="ghost" className="mt-4" fullWidth disabled={loading} onClick={() => void skip()}>
        {pl.loginSkip}
      </Button>
    </div>
  )
}
