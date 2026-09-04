import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import './styles/globals.css'
import { setupOnlineSync } from '@/lib/online-sync'
import { useAppStore } from '@/stores/app-store'
import { detectBrowserLang } from '@/i18n'
import { ErrorBoundary } from '@/components/ux/ErrorBoundary'
import { SplashScreen, hideSplash } from '@/components/brand/SplashScreen'
import { scheduleDailyReminder } from '@/lib/notifications'
import { applyThemeColor } from '@/lib/theme-color'
import { initErrorReporting } from '@/lib/analytics'
import { PwaUpdatePrompt } from '@/components/ux/PwaUpdatePrompt'
import { setupChunkLoadRecovery } from '@/lib/chunk-load-recovery'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'

initErrorReporting()
setupChunkLoadRecovery()
setupOnlineSync()

function applyPersistedUi(settings: ReturnType<typeof useAppStore.getState>['settings']) {
  // Set document language for SEO and accessibility
  if (typeof document !== 'undefined') {
    document.documentElement.lang = settings.language ?? 'pl'
  }
  if (settings.theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }
  applyThemeColor(settings.theme)
  if (settings.highContrast) {
    document.documentElement.setAttribute('data-high-contrast', 'true')
  } else {
    document.documentElement.removeAttribute('data-high-contrast')
  }
  if (
    settings.workoutReminders &&
    !settings.pushNotifications &&
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted'
  ) {
    scheduleDailyReminder(settings.reminderHour, 0)
  }
}

applyPersistedUi(useAppStore.getState().settings)
useAppStore.persist.onFinishHydration((state) => {
  // Auto-detect browser language on first run (no persisted language yet)
  if (!state.settings.language) {
    const detected = detectBrowserLang()
    if (detected !== 'pl') {
      useAppStore.getState().setSettings({ language: detected })
    }
  }
  applyPersistedUi(useAppStore.getState().settings)
})

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const theme = useAppStore.getState().settings.theme
  if (theme === 'system') applyThemeColor('system')
})

const splashHost = document.createElement('div')
document.body.insertBefore(splashHost, document.getElementById('root'))
createRoot(splashHost).render(<SplashScreen />)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <PwaUpdatePrompt />
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  </StrictMode>,
)

window.requestAnimationFrame(() => {
  // Hide HTML boot splash as soon as React splash mounts; then fade React splash.
  void import('@/lib/theme-color').then((m) => m.hideBootSplash())
  window.setTimeout(hideSplash, 900)
})
