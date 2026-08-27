import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { SetupStepper } from '@/components/setup/SetupStepper'
import { PageHeader } from '@/components/ui/PageHeader'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { navigateAfterAuth } from '@/lib/post-auth-navigation'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!isSupabaseConfigured) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigateAfterAuth(navigate)
    })
  }, [navigate])

  const skip = async () => {
    await navigateAfterAuth(navigate)
  }

  const sendLink = async () => {
    if (!isSupabaseConfigured) {
      await skip()
      return
    }
    const trimmed = email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      showToast(pl.loginInvalidEmail, 'error')
      return
    }
    setLoading(true)
    const redirectTo = `${window.location.origin}/setup/login`
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

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <SetupStepper current="login" />
      <PageHeader title={pl.loginTitle} subtitle={pl.loginSubtitle} />

      {sent ? (
        <p className="mt-2 text-[var(--sr-success)]">{pl.loginSent}</p>
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
        </>
      )}

      <Button variant="ghost" className="mt-4" fullWidth disabled={loading} onClick={() => void skip()}>
        {pl.loginSkip}
      </Button>
    </div>
  )
}
