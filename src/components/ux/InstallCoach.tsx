import { useEffect, useLayoutEffect, useState } from 'react'
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
export function InstallCoach({
  demotePrimary = false,
  onVisibilityChange,
}: {
  /** Use secondary/ghost so card CTA stays the only filled primary. */
  demotePrimary?: boolean
  /** Called only after eligibility is resolved — never report false prematurely. */
  onVisibilityChange?: (visible: boolean) => void
} = {}) {
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
  /** Do not report visibility until first eligibility pass completes. */
  const [eligibilityReady, setEligibilityReady] = useState(false)

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
    const settleAnon = window.setTimeout(() => {
      if (!cancelled) setLoggedIn((prev) => (prev === null ? false : prev))
    }, 2500)
    void supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setLoggedIn(!!data.session?.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setLoggedIn(!!session?.user)
    })
    return () => {
      cancelled = true
      window.clearTimeout(settleAnon)
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const standalone = isStandalonePwa()
    if (standalone) {
      // Wait for auth session before deciding login coach.
      if (isSupabaseConfigured && loggedIn === null) return

      const key = 'sr-tracked-standalone'
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          track('standalone_true')
        }
      } catch {
        track('standalone_true')
      }
      if (isSupabaseConfigured && loggedIn === false && !hasSeenStandaloneLoginCoach) {
        setShowLoginCoach(true)
      } else {
        setShowLoginCoach(false)
      }
      setShowInstall(false)
      setEligibilityReady(true)
      return
    }

    setShowLoginCoach(false)

    if (!hasCompletedFirstWorkout || hasDismissedInstallPrompt) {
      setShowInstall(false)
      setEligibilityReady(true)
      return
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (deferredInstall) {
      setIosHint(false)
      setShowInstall(true)
      setEligibilityReady(true)
    } else if (isIos) {
      setIosHint(true)
      setShowInstall(true)
      setEligibilityReady(true)
    } else {
      // Browser may still fire BIP later; settle as hidden for now.
      setShowInstall(false)
      setEligibilityReady(true)
    }
  }, [
    hasCompletedFirstWorkout,
    hasDismissedInstallPrompt,
    hasSeenStandaloneLoginCoach,
    deferredInstall,
    loggedIn,
  ])

  const visible = showLoginCoach || showInstall
  useLayoutEffect(() => {
    if (!eligibilityReady) return
    onVisibilityChange?.(visible)
  }, [visible, eligibilityReady, onVisibilityChange])

  const primaryVariant = demotePrimary ? 'secondary' : undefined

  if (!eligibilityReady) return null

  if (showLoginCoach) {
    return (
      <div className="mb-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] p-4">
        <p className="font-semibold text-[var(--sr-text-primary)]">{pl.standaloneLoginCoachTitle}</p>
        <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.standaloneLoginCoachBody}</p>
        <div className="mt-3 flex flex-col gap-2">
          <Button
            fullWidth
            variant={primaryVariant}
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
            variant={primaryVariant}
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
