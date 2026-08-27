import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { navigateAfterAuth } from '@/lib/post-auth-navigation'
import { showToast } from '@/stores/toast-store'

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
    setLoading(true)
    const redirectTo = `${window.location.origin}/setup/login`
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })
    setLoading(false)
    if (error) {
      showToast(error.message || 'Nie udało się wysłać linku. Spróbuj ponownie.', 'error')
      return
    }
    setSent(true)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
      <h1 className="text-xl font-bold">Zaloguj się</h1>
      <p className="mt-2 text-sm text-[var(--sr-text-secondary)]">
        Opcjonalnie — synchronizuj postęp między urządzeniami.
      </p>

      {sent ? (
        <p className="mt-6 text-[var(--sr-success)]">Link wysłany na {email}. Sprawdź skrzynkę.</p>
      ) : (
        <>
          <input
            type="email"
            placeholder="email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-6 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-[var(--sr-text-primary)]"
          />
          <Button className="mt-4" fullWidth disabled={loading || !email} onClick={() => void sendLink()}>
            Wyślij magic link
          </Button>
        </>
      )}

      <Button variant="ghost" className="mt-4" fullWidth onClick={() => void skip()}>
        Później — kontynuuj offline
      </Button>
    </div>
  )
}
