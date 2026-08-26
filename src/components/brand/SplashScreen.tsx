import { ProgressRing } from '@/components/ui/ProgressRing'
import { LogoMark } from '@/components/brand/Logo'

export function SplashScreen() {
  return (
    <div
      id="sr-splash"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--sr-bg-base)]"
      aria-hidden
    >
      <LogoMark size={96} />
      <p className="mt-4 sr-text-h2 sr-gradient-text">SmartReps</p>
      <div className="mt-6">
        <ProgressRing progress={0.65} size={120} strokeWidth={6}>
          <span className="sr-text-caption text-[var(--sr-text-muted)]">…</span>
        </ProgressRing>
      </div>
    </div>
  )
}

export function hideSplash() {
  const el = document.getElementById('sr-splash')
  if (el) {
    el.style.opacity = '0'
    el.style.transition = 'opacity 0.3s ease'
    window.setTimeout(() => el.remove(), 300)
  }
}
