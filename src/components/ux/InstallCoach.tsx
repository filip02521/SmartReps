import { useEffect, useLayoutEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NoticeCard, Download, LogIn } from '@/components/ux/NoticeCard'
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
  demotePrimary?: boolean
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

  void demotePrimary

  if (!eligibilityReady) return null

  if (showLoginCoach) {
    return (
      <NoticeCard
        className="mb-4"
        tone="brand"
        icon={<LogIn size={20} strokeWidth={2.25} />}
        title={pl.standaloneLoginCoachTitle}
        message={pl.standaloneLoginCoachBody}
        actionLabel={pl.standaloneLoginCoachCta}
        onAction={() => {
          setHasSeenStandaloneLoginCoach(true)
          navigate('/setup/login', { state: { returnTo: '/' } })
        }}
        dismissLabel={pl.standaloneLoginCoachDismiss}
        onDismiss={() => {
          setHasSeenStandaloneLoginCoach(true)
          setShowLoginCoach(false)
        }}
        demotePrimary={demotePrimary}
        stackActions
      />
    )
  }

  if (!showInstall) return null

  return (
    <NoticeCard
      className="mb-4"
      tone="brand"
      icon={<Download size={20} strokeWidth={2.25} />}
      title={pl.installPromptTitle}
      message={iosHint ? pl.installIosHint : pl.installPromptBody}
      actionLabel={deferredInstall ? pl.installPromptCta : undefined}
      onAction={
        deferredInstall
          ? () => {
              void (async () => {
                await deferredInstall.prompt()
                setHasDismissedInstallPrompt(true)
                setShowInstall(false)
                track('a2hs_prompt')
              })()
            }
          : undefined
      }
      dismissLabel={pl.installPromptDismiss}
      onDismiss={() => {
        setHasDismissedInstallPrompt(true)
        setShowInstall(false)
      }}
      demotePrimary={demotePrimary}
      stackActions
    />
  )
}
