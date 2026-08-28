import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LogoFull } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { TextField } from '@/components/ui/TextField'
import { PageLoader } from '@/components/ux/Feedback'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { isSafeReturnPath, resolvePostAuthNavigation } from '@/lib/post-auth-navigation'
import {
  completeSignInFlow,
  consumeAuthReturnTo,
  peekAuthFromOnboarding,
  peekAuthReturnTo,
  setAuthFromOnboarding,
  setAuthReturnTo,
} from '@/lib/auth-sync'
import { signOutUser } from '@/lib/auth-lifecycle'
import { isStandalonePwa } from '@/lib/pwa-detect'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'
import { track } from '@/lib/analytics'

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

function hasAuthCallbackInUrl(): boolean {
  const search = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return (
    hash.has('access_token') ||
    hash.has('refresh_token') ||
    search.has('code') ||
    search.has('token_hash')
  )
}

function stripAuthParamsFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('code')
  url.searchParams.delete('token_hash')
  url.hash = ''
  window.history.replaceState({}, '', `${url.pathname}${url.search}`)
}

/** Must match Supabase `mailer_otp_length` (scripts/configure-supabase-smtp.mjs). */
const OTP_LENGTH = 6
const OTP_PATTERN = new RegExp(`^\\d{${OTP_LENGTH}}$`)

async function verifyEmailOtp(email: string, token: string) {
  const attempt = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (!attempt.error) return attempt
  // New accounts sometimes verify under signup until email is confirmed.
  return supabase.auth.verifyOtp({ email, token, type: 'signup' })
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
  const verifyingRef = useRef(false)
  const returnTo = readReturnTo(location.state as LoginLocationState | null, location.search)
  const fromOnboarding =
    (location.state as LoginLocationState | null)?.fromOnboarding === true ||
    peekAuthFromOnboarding() ||
    new URLSearchParams(location.search).get('fromOnboarding') === '1'

  useEffect(() => {
    if (returnTo) setAuthReturnTo(returnTo)
  }, [returnTo])

  useEffect(() => {
    setAuthFromOnboarding(fromOnboarding)
  }, [fromOnboarding])

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

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured || !hasAuthCallbackInUrl()) return

    void (async () => {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        stripAuthParamsFromUrl()
        if (session) {
          await completeSignInFlow(navigate, {
            returnTo: returnTo ?? consumeAuthReturnTo(),
            showSuccessToast: true,
            showFailureToast: true,
          })
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [hydrated, navigate, returnTo])

  const effectiveReturnTo = () => returnTo ?? peekAuthReturnTo()

  const continueSignedIn = async () => {
    setLoading(true)
    try {
      await completeSignInFlow(navigate, {
        returnTo: effectiveReturnTo() ?? consumeAuthReturnTo(),
        showSuccessToast: true,
        showFailureToast: true,
      })
    } finally {
      setLoading(false)
    }
  }

  const logoutToSwitch = async () => {
    setLoading(true)
    try {
      await signOutUser()
      setSignedInEmail(null)
      setSent(false)
      setEmail('')
      setOtpCode('')
      showToast(pl.loginLogoutToSwitchDone, 'info')
    } catch {
      showToast(pl.logoutFailed, 'error')
    } finally {
      setLoading(false)
    }
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
    if (fromOnboarding) params.set('fromOnboarding', '1')
    const query = params.toString()
    const redirectTo = `${window.location.origin}/setup/login${query ? `?${query}` : ''}`
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      showToast(pl.errorSendLink, 'error')
      return
    }
    setSent(true)
    setOtpCode('')
  }

  const verifyCode = async () => {
    if (verifyingRef.current) return
    const trimmed = email.trim()
    const code = otpCode.replace(/\D/g, '')
    if (!OTP_PATTERN.test(code)) {
      showToast(pl.loginOtpInvalid, 'error')
      return
    }
    verifyingRef.current = true
    setLoading(true)
    try {
      const { error } = await verifyEmailOtp(trimmed, code)
      if (error) {
        track('otp_verify_fail')
        showToast(pl.loginOtpInvalid, 'error')
        return
      }
      track('otp_verify_ok')
      await completeSignInFlow(navigate, {
        returnTo: effectiveReturnTo() ?? consumeAuthReturnTo(),
        showSuccessToast: true,
        showFailureToast: true,
      })
    } finally {
      verifyingRef.current = false
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!sent || loading || otpCode.length !== OTP_LENGTH) return
    void verifyCode()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-submit when full OTP entered
  }, [otpCode, sent, loading])

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
        <LogoFull height={40} className="mx-auto mb-4" />
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
      <LogoFull height={40} className="mx-auto mb-4" />
      <PageHeader
        title={fromOnboarding ? pl.loginTitleReturning : pl.loginTitle}
        subtitle={fromOnboarding ? pl.loginSubtitleReturning : pl.loginSubtitle}
      />

      {sent ? (
        <div className="mt-2 space-y-4">
          <p className="text-[var(--sr-success)]">{pl.loginSentCode}</p>
          <p className="text-sm text-[var(--sr-text-secondary)]">
            {pl.loginSentTo(email.trim())}
          </p>

          <div>
            <TextField
              id="login-otp"
              label={pl.loginOtpLabel}
              hint={pl.loginOtpHint}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={OTP_LENGTH}
              placeholder={pl.loginOtpPlaceholder}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH))}
              inputClassName="text-center text-2xl tracking-[0.35em]"
            />
          </div>

          <Button
            className="mt-2"
            fullWidth
            disabled={loading || otpCode.length !== OTP_LENGTH}
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
          <TextField
            id="login-email"
            className="mt-4"
            label={pl.loginEmailLabel}
            type="email"
            autoComplete="email"
            placeholder={pl.loginEmailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button className="mt-4" fullWidth disabled={loading || !email.trim()} onClick={() => void sendOtp()}>
            {pl.loginSendCode}
          </Button>
        </>
      )}

      <Button variant="ghost" className="mt-4" fullWidth disabled={loading} onClick={() => void skip()}>
        {fromOnboarding ? pl.backToOnboarding : pl.loginSkip}
      </Button>

      <p className="mt-6 text-center text-xs text-[var(--sr-text-muted)]">
        <Link to="/privacy" className="text-[var(--sr-brand-primary)]">
          {pl.privacyLink}
        </Link>
        {' · '}
        <Link to="/terms" className="text-[var(--sr-brand-primary)]">
          {pl.termsLink}
        </Link>
      </p>
    </div>
  )
}
