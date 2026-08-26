import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
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
import { ToastHost } from '@/components/ux/Toast'

export default function App() {
  return (
    <BrowserRouter>
      <ToastHost />
      <Routes>
        <Route path="/setup/onboarding" element={<Onboarding />} />
        <Route path="/setup/test/:program" element={<MaxTest />} />
        <Route path="/setup/cycle/:program" element={<CyclePicker />} />
        <Route path="/setup/start/:program" element={<ProgramStart />} />
        <Route path="/setup/login" element={<Login />} />
        <Route path="/setup/technique" element={<TechniquePushups />} />

        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        <Route path="/workout/:program" element={<WorkoutPage />} />
        <Route path="/workout/:program/summary" element={<SessionSummary />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
