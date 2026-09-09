import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazyWithChunkRecovery } from '@/lib/chunk-load-recovery'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthBridge } from '@/components/ux/AuthBridge'
import { GlobalOfflineBar } from '@/components/ux/GlobalOfflineBar'
import { RequireOnboarding, RequireProgram } from '@/components/ux/RequireOnboarding'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { useAppStore } from '@/stores/app-store'
import Dashboard from '@/pages/Dashboard'
import WorkoutPage from '@/pages/Workout'
import SessionSummary from '@/pages/SessionSummary'
import CustomWorkoutPage from '@/pages/CustomWorkout'
import CustomSessionSummary from '@/pages/CustomSessionSummary'
import Onboarding from '@/pages/setup/Onboarding'
import MaxTest from '@/pages/setup/MaxTest'
import CyclePicker from '@/pages/setup/CyclePicker'
import ProgramStart from '@/pages/setup/ProgramStart'
import Login from '@/pages/setup/Login'
import TechniquePushups from '@/pages/setup/TechniquePushups'
import TechniquePullups from '@/pages/setup/TechniquePullups'
import TechniqueSquats from '@/pages/setup/TechniqueSquats'
import NotFound from '@/pages/NotFound'
import { DemoPreview } from '@/pages/DemoPreview'
import PrivacyPage from '@/pages/legal/Privacy'
import TermsPage from '@/pages/legal/Terms'
import { ToastHost } from '@/components/ux/Toast'
import { AccountSwitchGate } from '@/components/ux/AccountSwitchGate'
import { AchievementHost } from '@/components/achievements/AchievementHost'
import { ResumeWorkoutPrompt } from '@/components/workout/ResumeWorkoutPrompt'
import { RouteErrorBoundary } from '@/components/ux/RouteErrorBoundary'

const ProgressPage = lazy(lazyWithChunkRecovery(() => import('@/pages/Progress')))
const PlansPage = lazy(lazyWithChunkRecovery(() => import('@/pages/Plans')))
const ProfilePage = lazy(lazyWithChunkRecovery(() => import('@/pages/Profile')))
const CommunityPublicationPage = lazy(
  lazyWithChunkRecovery(() => import('@/pages/CommunityPublication')),
)

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <RouteErrorBoundary>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center py-16">
            <BrandLoader size={44} />
          </div>
        }
      >
        {children}
      </Suspense>
    </RouteErrorBoundary>
  )
}

/** Eager (non-lazy) routes also need an error boundary — a runtime error
 *  in Workout, Onboarding, Login, etc. should show a retry UI, not crash
 *  the whole app. */
function EagerPage({ children }: { children: React.ReactNode }) {
  return <RouteErrorBoundary>{children}</RouteErrorBoundary>
}

export default function App() {
  // Re-render entire tree when language changes — proxy-based i18n needs this
  // to refresh all `pl.foo` references in 123+ files without refactoring them.
  const language = useAppStore((s) => s.settings.language ?? 'pl')

  // Keep <html lang> in sync with active language for accessibility + SEO.
  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  return (
    <BrowserRouter key={language}>
      <ToastHost />
      <AuthBridge />
      <AccountSwitchGate />
      <AchievementHost />
      <ResumeWorkoutPrompt />
      <GlobalOfflineBar />
      <Routes>
        <Route path="/privacy" element={<EagerPage><PrivacyPage /></EagerPage>} />
        <Route path="/terms" element={<EagerPage><TermsPage /></EagerPage>} />
        <Route
          path="/community/:slug"
          element={
            <LazyPage>
              <CommunityPublicationPage />
            </LazyPage>
          }
        />
        <Route path="/setup/onboarding" element={<EagerPage><Onboarding /></EagerPage>} />
        <Route path="/setup/login" element={<EagerPage><Login /></EagerPage>} />
        <Route path="/setup/technique" element={<EagerPage><TechniquePushups /></EagerPage>} />
        <Route path="/setup/technique-pullups" element={<EagerPage><TechniquePullups /></EagerPage>} />
        <Route path="/setup/technique-squats" element={<EagerPage><TechniqueSquats /></EagerPage>} />

        <Route element={<RequireOnboarding />}>
          <Route element={<RequireProgram />}>
            <Route path="/setup/test/:program" element={<EagerPage><MaxTest /></EagerPage>} />
            <Route path="/setup/cycle/:program" element={<EagerPage><CyclePicker /></EagerPage>} />
            <Route path="/setup/start/:program" element={<EagerPage><ProgramStart /></EagerPage>} />
          </Route>

          <Route element={<AppLayout />}>
            <Route path="/" element={<EagerPage><Dashboard /></EagerPage>} />
            <Route
              path="/progress"
              element={
                <LazyPage>
                  <ProgressPage />
                </LazyPage>
              }
            />
            <Route
              path="/plans"
              element={
                <LazyPage>
                  <PlansPage />
                </LazyPage>
              }
            />
            <Route
              path="/profile"
              element={
                <LazyPage>
                  <ProfilePage />
                </LazyPage>
              }
            />
          </Route>

          <Route element={<RequireProgram />}>
            <Route path="/workout/:program" element={<EagerPage><WorkoutPage /></EagerPage>} />
            <Route path="/workout/:program/summary" element={<EagerPage><SessionSummary /></EagerPage>} />
          </Route>
          <Route path="/workout/custom/:planId" element={<EagerPage><CustomWorkoutPage /></EagerPage>} />
          <Route path="/workout/custom/:planId/summary" element={<EagerPage><CustomSessionSummary /></EagerPage>} />
        </Route>
        <Route path="/not-found" element={<EagerPage><NotFound /></EagerPage>} />
        <Route path="/demo-preview" element={<EagerPage><DemoPreview /></EagerPage>} />
        <Route path="*" element={<EagerPage><NotFound /></EagerPage>} />
      </Routes>
    </BrowserRouter>
  )
}
