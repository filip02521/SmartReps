import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { pullRemoteData, syncAllLocalData } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { isWorkoutAvailable } from '@/lib/progress-engine'

export default function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const goHomeOrNextSetup = async () => {
    const { setupQueue, shiftSetupQueue, pendingStart, clearPendingStart } = useAppStore.getState()

    if (pendingStart) {
      const { program, navigateToWorkout } = pendingStart
      clearPendingStart()
      if (navigateToWorkout) {
        const prog = await getProgramProgress(program)
        const ready = !prog?.nextWorkoutAfter || isWorkoutAvailable(new Date(prog.nextWorkoutAfter))
        if (ready && prog?.status !== 'test_pending') {
          navigate(`/workout/${program}`)
          return
        }
      }
      navigate('/')
      return
    }

    const next = setupQueue[0]
    if (next) {
      const prog = await getProgramProgress(next)
      shiftSetupQueue()
      if (!prog) {
        navigate(`/setup/test/${next}`)
        return
      }
    }
    navigate('/')
  }

  useEffect(() => {
    if (!isSupabaseConfigured) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        await pullRemoteData()
        await syncAllLocalData()
        await goHomeOrNextSetup()
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  const skip = async () => {
    await goHomeOrNextSetup()
  }

  const sendLink = async () => {
    if (!isSupabaseConfigured) {
      await skip()
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setLoading(false)
    if (!error) setSent(true)
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
