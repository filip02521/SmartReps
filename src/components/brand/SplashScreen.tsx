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
      {/* Mark + wordmark render without the enter animation — they sit under
          the identical HTML boot splash, which fades out on top of them.
          Only the tagline + loader animate in. */}
      <div className="flex flex-col items-center">
        <div className="sr-logo-breathe">
          <LogoMark size={88} />
        </div>
        <p className="mt-6 sr-text-h2 tracking-tight" aria-hidden>
          <span className="font-normal text-[var(--sr-text-primary)]">Smart</span>
          <span className="sr-gradient-text font-bold">Reps</span>
        </p>
        <div className="flex flex-col items-center sr-loader-enter">
          <p className="mt-2 sr-text-caption text-[var(--sr-text-muted)]">
            {pl.splashTagline}
          </p>
          <div className="mt-8">
            <BrandLoader size={40} />
          </div>
        </div>
      </div>
    </div>
  )
}

export function hideSplash() {
  const el = document.getElementById('sr-splash')
  if (el) {
    el.style.opacity = '0'
    el.style.transition = 'opacity 0.35s ease'
    el.setAttribute('aria-hidden', 'true')
    window.setTimeout(() => el.remove(), 350)
  }
  void import('@/lib/theme-color').then((m) => m.hideBootSplash())
}
