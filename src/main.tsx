import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import { setupOnlineSync } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { ErrorBoundary } from '@/components/ux/ErrorBoundary'
import { SplashScreen, hideSplash } from '@/components/brand/SplashScreen'
import { scheduleDailyReminder } from '@/lib/notifications'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/500.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'

setupOnlineSync()

function applyPersistedUi(settings: ReturnType<typeof useAppStore.getState>['settings']) {
  if (settings.theme === 'system') {
    document.documentElement.removeAttribute('data-theme')
  } else {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }
  if (settings.highContrast) {
    document.documentElement.setAttribute('data-high-contrast', 'true')
  } else {
    document.documentElement.removeAttribute('data-high-contrast')
  }
  if (settings.workoutReminders && Notification.permission === 'granted') {
    scheduleDailyReminder()
  }
}

applyPersistedUi(useAppStore.getState().settings)
useAppStore.persist.onFinishHydration((state) => {
  applyPersistedUi(state.settings)
})

const splashHost = document.createElement('div')
document.body.insertBefore(splashHost, document.getElementById('root'))
createRoot(splashHost).render(<SplashScreen />)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

window.requestAnimationFrame(() => {
  window.setTimeout(hideSplash, 500)
})
