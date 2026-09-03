import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MailCheck, Loader2, Mail } from 'lucide-react'
import { LogoFull } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { TextField } from '@/components/ui/TextField'
import { OtpInput } from '@/components/ui/OtpInput'
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
/** Must match Supabase `smtp_max_frequency` (seconds between OTP emails). */
const OTP_RESEND_COOLDOWN_SEC = 30

function parseOtpRateLimitSeconds(message: string | undefined): number | null {
  if (!message) return null
  const match = message.match(/after\s+(\d+)\s+seconds?/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

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
  const [resendIn, setResendIn] = useState(0)
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
    if (resendIn <= 0) return
    const id = window.setTimeout(() => setResendIn((n) => Math.max(0, n - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [resendIn])

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
        setResendIn(0)
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
    if (resendIn > 0) {
      showToast(pl.loginOtpRateLimited(resendIn), 'info')
      return
    }
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast(pl.loginInvalidEmail, 'error')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      // Code-only login: do not attach a magic-link redirect. OTP arrives as {{ .Token }}.
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      const wait = parseOtpRateLimitSeconds(error.message) ?? OTP_RESEND_COOLDOWN_SEC
      if (
        error.status === 429 ||
        /rate.?limit|after\s+\d+\s+seconds/i.test(error.message ?? '')
      ) {
        setResendIn(wait)
        setSent(true)
        showToast(pl.loginOtpRateLimited(wait), 'info')
        return
      }
      showToast(pl.errorSendLink, 'error')
      return
    }
    setSent(true)
    setOtpCode('')
    setResendIn(OTP_RESEND_COOLDOWN_SEC)
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
          {/* Success banner — code sent */}
          <div className="flex items-start gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)] p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-success)]/15 text-[var(--sr-success)]" aria-hidden>
              <MailCheck size={20} strokeWidth={2.25} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-[var(--sr-text-primary)]">{pl.loginSentCode}</p>
              <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">
                {pl.loginSentTo(email.trim())}
              </p>
            </div>
          </div>

          {/* OTP input — 6 separate boxes */}
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.loginOtpLabel}
            </label>
            <OtpInput
              length={OTP_LENGTH}
              value={otpCode}
              onChange={(code) => setOtpCode(code)}
              disabled={loading}
              autoFocus
            />
            <p className="mt-2 text-xs text-[var(--sr-text-muted)]">{pl.loginOtpHint}</p>
          </div>

          {/* Verify button with loading spinner */}
          <Button
            className="mt-2"
            fullWidth
            disabled={loading || otpCode.length !== OTP_LENGTH}
            onClick={() => void verifyCode()}
          >
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" aria-hidden />
                {pl.loginVerifying}
              </span>
            ) : (
              pl.loginVerifyCode
            )}
          </Button>

          {/* Resend button */}
          <Button
            variant="secondary"
            fullWidth
            disabled={loading || resendIn > 0}
            onClick={() => void sendOtp()}
          >
            {resendIn > 0 ? pl.loginResendWait(resendIn) : pl.loginResendCode}
          </Button>

          {/* Hint — PWA vs browser */}
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
            {loading ? (
              <span className="inline-flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" aria-hidden />
                {pl.loginSending}
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2">
                <Mail size={18} aria-hidden />
                {pl.loginSendCode}
              </span>
            )}
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
