import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppStore } from '@/stores/app-store'

/** Redirects to onboarding when the user has not finished first-run setup. */
export function RequireOnboarding() {
  const complete = useAppStore((s) => s.settings.onboardingComplete)
  const location = useLocation()

  if (!complete) {
    return <Navigate to="/setup/onboarding" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
