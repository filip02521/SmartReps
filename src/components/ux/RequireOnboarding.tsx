import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { PageLoader } from '@/components/ux/Feedback'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { runAuthenticatedSync } from '@/lib/auth-sync'
import { completeOnboardingIfSynced } from '@/lib/onboarding-from-sync'
import { isProgram } from '@/lib/setup-flow'

/** Redirects to onboarding when the user has not finished first-run setup. */
export function RequireOnboarding() {
  const hydrated = useStoreHydrated()
  const complete = useAppStore((s) => s.settings.onboardingComplete)
  const location = useLocation()
  const [checkingAccount, setCheckingAccount] = useState(false)

  useEffect(() => {
    if (!hydrated || complete || !isSupabaseConfigured) return

    let cancelled = false
    void (async () => {
      setCheckingAccount(true)
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session || cancelled) return
        await runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
        if (!cancelled) await completeOnboardingIfSynced()
      } finally {
        if (!cancelled) setCheckingAccount(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [hydrated, complete])

  if (!hydrated || checkingAccount) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader />
      </div>
    )
  }

  if (!complete) {
    return <Navigate to="/setup/onboarding" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

/** Validates :program route param is pushups | pullups. */
export function RequireProgram() {
  const { program } = useParams<{ program: string }>()
  if (!isProgram(program)) {
    return <Navigate to="/not-found" replace />
  }
  return <Outlet />
}
