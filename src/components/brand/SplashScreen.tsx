import { BrandLoader } from '@/components/ui/BrandLoader'
import { LogoMark } from '@/components/brand/Logo'
import { pl } from '@/i18n/pl'

export function SplashScreen() {
  return (
    <div
      id="sr-splash"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--sr-bg-base)]"
      role="status"
      aria-live="polite"
      aria-label={pl.loading}
    >
      <div className="flex flex-col items-center sr-loader-enter">
        <div className="sr-logo-breathe">
          <LogoMark size={88} />
        </div>
        <p className="mt-5 sr-text-h2 sr-gradient-text">SmartReps</p>
        <div className="mt-8">
          <BrandLoader size={44} />
        </div>
        <p className="mt-4 sr-text-caption text-[var(--sr-text-muted)]">{pl.loading}</p>
      </div>
    </div>
  )
}

export function hideSplash() {
  const el = document.getElementById('sr-splash')
  if (!el) return
  el.style.opacity = '0'
  el.style.transition = 'opacity 0.35s ease'
  window.setTimeout(() => el.remove(), 350)
}
