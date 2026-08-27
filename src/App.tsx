import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthBridge } from '@/components/ux/AuthBridge'
import { GlobalOfflineBar } from '@/components/ux/GlobalOfflineBar'
import { RequireOnboarding, RequireProgram } from '@/components/ux/RequireOnboarding'
import Dashboard from '@/pages/Dashboard'
import WorkoutPage from '@/pages/Workout'
import SessionSummary from '@/pages/SessionSummary'
import ProgressPage from '@/pages/Progress'
import PlansPage from '@/pages/Plans'
import ProfilePage from '@/pages/Profile'
import Onboarding from '@/pages/setup/Onboarding'
import MaxTest from '@/pages/setup/MaxTest'
import CyclePicker from '@/pages/setup/CyclePicker'
import ProgramStart from '@/pages/setup/ProgramStart'
import Login from '@/pages/setup/Login'
import TechniquePushups from '@/pages/setup/TechniquePushups'
import NotFound from '@/pages/NotFound'
import { ToastHost } from '@/components/ux/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <ToastHost />
      <AuthBridge />
      <GlobalOfflineBar />
      <Routes>
        <Route path="/setup/onboarding" element={<Onboarding />} />
        <Route element={<RequireProgram />}>
          <Route path="/setup/test/:program" element={<MaxTest />} />
          <Route path="/setup/cycle/:program" element={<CyclePicker />} />
          <Route path="/setup/start/:program" element={<ProgramStart />} />
        </Route>
        <Route path="/setup/login" element={<Login />} />
        <Route path="/setup/technique" element={<TechniquePushups />} />

        <Route element={<RequireOnboarding />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route element={<RequireProgram />}>
            <Route path="/workout/:program" element={<WorkoutPage />} />
            <Route path="/workout/:program/summary" element={<SessionSummary />} />
          </Route>
        </Route>
        <Route path="/not-found" element={<NotFound />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}
