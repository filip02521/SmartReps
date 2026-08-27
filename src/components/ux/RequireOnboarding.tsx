import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { SkeletonCard } from '@/components/ux/Feedback'
import { isProgram } from '@/lib/setup-flow'

/** Redirects to onboarding when the user has not finished first-run setup. */
export function RequireOnboarding() {
  const hydrated = useStoreHydrated()
  const complete = useAppStore((s) => s.settings.onboardingComplete)
  const location = useLocation()

  if (!hydrated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <SkeletonCard className="h-32" />
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
