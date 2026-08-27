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
import { isStandalonePwa } from '@/lib/pwa-detect'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'

type LoginLocationState = { returnTo?: string; fromOnboarding?: boolean }

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
  const [otpCode, setOtpCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const hydrated = useStoreHydrated()
  const standalone = isStandalonePwa()
  const returnTo = readReturnTo(location.state as LoginLocationState | null, location.search)
  const fromOnboarding = (location.state as LoginLocationState | null)?.fromOnboarding === true

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
        setOtpCode('')
        return
      }
      if (session?.user.email) {
        setSignedInEmail(session.user.email)
      }
    })

    return () => subscription.unsubscribe()
  }, [hydrated])

  const effectiveReturnTo = () => returnTo ?? peekAuthReturnTo()

  const finishLogin = async () => {
    await runAuthenticatedSync({ showSuccessToast: true, showFailureToast: true })
    await resolvePostAuthNavigation(navigate, effectiveReturnTo() ?? consumeAuthReturnTo())
  }

  const continueSignedIn = async () => {
    setLoading(true)
    try {
      await finishLogin()
    } finally {
      setLoading(false)
    }
  }

  const logoutToSwitch = async () => {
    setLoading(true)
    await supabase.auth.signOut()
    setSignedInEmail(null)
    setSent(false)
    setEmail('')
    setOtpCode('')
    setLoading(false)
    showToast(pl.loginLogoutToSwitchDone, 'info')
  }

  const skip = async () => {
    if (fromOnboarding) {
      navigate('/setup/onboarding', { replace: true })
      return
    }
    await resolvePostAuthNavigation(navigate, effectiveReturnTo() ?? consumeAuthReturnTo())
  }

  const sendOtp = async () => {
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
    setOtpCode('')
  }

  const verifyCode = async () => {
    const trimmed = email.trim()
    const code = otpCode.replace(/\s/g, '')
    if (!/^\d{6,8}$/.test(code)) {
      showToast(pl.loginOtpInvalid, 'error')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: trimmed,
      token: code,
      type: 'email',
    })
    if (error) {
      setLoading(false)
      showToast(error.message || pl.loginOtpInvalid, 'error')
      return
    }
    try {
      await finishLogin()
    } finally {
      setLoading(false)
    }
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
        {!fromOnboarding && <SetupStepper current="login" />}
        <PageHeader
          title={fromOnboarding ? pl.loginTitleReturning : pl.loginTitle}
          subtitle={fromOnboarding ? pl.loginSubtitleReturning : pl.loginSubtitle}
        />
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
      {!fromOnboarding && <SetupStepper current="login" />}
      <PageHeader
        title={fromOnboarding ? pl.loginTitleReturning : pl.loginTitle}
        subtitle={fromOnboarding ? pl.loginSubtitleReturning : pl.loginSubtitle}
      />

      {sent ? (
        <div className="mt-2 space-y-4">
          <p className="text-[var(--sr-success)]">{pl.loginSentCode}</p>

          <div>
            <label htmlFor="login-otp" className="block text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.loginOtpLabel}
            </label>
            <input
              id="login-otp"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder={pl.loginOtpPlaceholder}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
              className="mt-2 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-center text-2xl tracking-[0.35em] text-[var(--sr-text-primary)]"
            />
            <p className="mt-2 text-xs text-[var(--sr-text-muted)]">{pl.loginOtpHint}</p>
          </div>

          <Button
            className="mt-2"
            fullWidth
            disabled={loading || otpCode.length < 6}
            onClick={() => void verifyCode()}
          >
            {pl.loginVerifyCode}
          </Button>

          <Button variant="secondary" fullWidth disabled={loading} onClick={() => void sendOtp()}>
            {pl.loginResendCode}
          </Button>

          {standalone ? (
            <p className="rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] p-3 text-sm text-[var(--sr-text-secondary)]">
              {pl.loginPwaCodeHint}
            </p>
          ) : (
            <p className="text-xs leading-relaxed text-[var(--sr-text-muted)]">{pl.loginBrowserLinkHint}</p>
          )}
        </div>
      ) : (
        <>
          {standalone && (
            <p className="mt-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] p-3 text-sm text-[var(--sr-text-secondary)]">
              {pl.loginPwaCodeHint}
            </p>
          )}
          <label htmlFor="login-email" className="mt-4 block text-sm font-medium text-[var(--sr-text-secondary)]">
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
          <Button className="mt-4" fullWidth disabled={loading || !email.trim()} onClick={() => void sendOtp()}>
            {pl.loginSendCode}
          </Button>
        </>
      )}

      <Button variant="ghost" className="mt-4" fullWidth disabled={loading} onClick={() => void skip()}>
        {fromOnboarding ? pl.backToOnboarding : pl.loginSkip}
      </Button>
    </div>
  )
}
