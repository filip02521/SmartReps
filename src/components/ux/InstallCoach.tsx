import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { pl } from '@/i18n/pl'
import { useAppStore } from '@/stores/app-store'
import { isStandalonePwa } from '@/lib/pwa-detect'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { track } from '@/lib/analytics'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Soft A2HS + standalone login coach for Dashboard. */
export function InstallCoach() {
  const navigate = useNavigate()
  const {
    hasCompletedFirstWorkout,
    hasDismissedInstallPrompt,
    hasSeenStandaloneLoginCoach,
    setHasDismissedInstallPrompt,
    setHasSeenStandaloneLoginCoach,
  } = useAppStore()
  const [showInstall, setShowInstall] = useState(false)
  const [showLoginCoach, setShowLoginCoach] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [deferredInstall, setDeferredInstall] = useState<BeforeInstallPromptEvent | null>(null)
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferredInstall(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBip)
    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoggedIn(false)
      return
    }
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setLoggedIn(!!data.session?.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user)
    })
    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const standalone = isStandalonePwa()
    if (standalone) {
      const key = 'sr-tracked-standalone'
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          track('standalone_true')
        }
      } catch {
        track('standalone_true')
      }
      // Only coach login when cloud is available and user is logged out
      if (isSupabaseConfigured && loggedIn === false && !hasSeenStandaloneLoginCoach) {
        setShowLoginCoach(true)
      } else {
        setShowLoginCoach(false)
      }
      setShowInstall(false)
      return
    }
    if (!hasCompletedFirstWorkout || hasDismissedInstallPrompt) {
      setShowInstall(false)
      return
    }
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (deferredInstall) {
      setIosHint(false)
      setShowInstall(true)
    } else if (isIos) {
      setIosHint(true)
      setShowInstall(true)
    }
  }, [
    hasCompletedFirstWorkout,
    hasDismissedInstallPrompt,
    hasSeenStandaloneLoginCoach,
    deferredInstall,
    loggedIn,
  ])

  if (showLoginCoach) {
    return (
      <div className="mb-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] p-4">
        <p className="font-semibold text-[var(--sr-text-primary)]">{pl.standaloneLoginCoachTitle}</p>
        <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.standaloneLoginCoachBody}</p>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            fullWidth
            onClick={() => {
              setHasSeenStandaloneLoginCoach(true)
              navigate('/setup/login', { state: { returnTo: '/' } })
            }}
          >
            {pl.standaloneLoginCoachCta}
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              setHasSeenStandaloneLoginCoach(true)
              setShowLoginCoach(false)
            }}
          >
            {pl.standaloneLoginCoachDismiss}
          </Button>
        </div>
      </div>
    )
  }

  if (!showInstall) return null

  return (
    <div className="mb-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-4">
      <p className="font-semibold text-[var(--sr-text-primary)]">{pl.installPromptTitle}</p>
      <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
        {iosHint ? pl.installIosHint : pl.installPromptBody}
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {deferredInstall && (
          <Button
            fullWidth
            onClick={async () => {
              await deferredInstall.prompt()
              setHasDismissedInstallPrompt(true)
              setShowInstall(false)
              track('a2hs_prompt')
            }}
          >
            {pl.installPromptCta}
          </Button>
        )}
        <Button
          variant="ghost"
          fullWidth
          onClick={() => {
            setHasDismissedInstallPrompt(true)
            setShowInstall(false)
          }}
        >
          {pl.installPromptDismiss}
        </Button>
      </div>
    </div>
  )
}
