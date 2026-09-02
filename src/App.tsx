import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazyWithChunkRecovery } from '@/lib/chunk-load-recovery'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthBridge } from '@/components/ux/AuthBridge'
import { GlobalOfflineBar } from '@/components/ux/GlobalOfflineBar'
import { RequireOnboarding, RequireProgram } from '@/components/ux/RequireOnboarding'
import { BrandLoader } from '@/components/ui/BrandLoader'
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
import NotFound from '@/pages/NotFound'
import PrivacyPage from '@/pages/legal/Privacy'
import TermsPage from '@/pages/legal/Terms'
import { ToastHost } from '@/components/ux/Toast'
import { AccountSwitchGate } from '@/components/ux/AccountSwitchGate'

const ProgressPage = lazy(lazyWithChunkRecovery(() => import('@/pages/Progress')))
const PlansPage = lazy(lazyWithChunkRecovery(() => import('@/pages/Plans')))
const ProfilePage = lazy(lazyWithChunkRecovery(() => import('@/pages/Profile')))
const CommunityPublicationPage = lazy(
  lazyWithChunkRecovery(() => import('@/pages/CommunityPublication')),
)

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center py-16">
          <BrandLoader size={44} />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastHost />
      <AuthBridge />
      <AccountSwitchGate />
      <GlobalOfflineBar />
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route
          path="/community/:slug"
          element={
            <LazyPage>
              <CommunityPublicationPage />
            </LazyPage>
          }
        />
        <Route path="/setup/onboarding" element={<Onboarding />} />
        <Route path="/setup/login" element={<Login />} />
        <Route path="/setup/technique" element={<TechniquePushups />} />
        <Route path="/setup/technique-pullups" element={<TechniquePullups />} />

        <Route element={<RequireOnboarding />}>
          <Route element={<RequireProgram />}>
            <Route path="/setup/test/:program" element={<MaxTest />} />
            <Route path="/setup/cycle/:program" element={<CyclePicker />} />
            <Route path="/setup/start/:program" element={<ProgramStart />} />
          </Route>

          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
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
            <Route path="/workout/:program" element={<WorkoutPage />} />
            <Route path="/workout/:program/summary" element={<SessionSummary />} />
          </Route>
          <Route path="/workout/custom/:planId" element={<CustomWorkoutPage />} />
          <Route path="/workout/custom/:planId/summary" element={<CustomSessionSummary />} />
        </Route>
        <Route path="/not-found" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
