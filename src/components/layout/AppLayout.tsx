import { Link, Outlet, useLocation } from 'react-router-dom'
import { Activity, BarChart3, List, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import { useWorkoutStore } from '@/stores/workout-store'
import { FOCUS_RING, Z_TAB_BAR } from '@/lib/ui-chrome'

const tabs = [
  { to: '/', label: pl.navWorkout, icon: Activity },
  { to: '/progress', label: pl.navProgress, icon: BarChart3 },
  { to: '/plans', label: pl.navPlans, icon: List },
  { to: '/profile', label: pl.navProfile, icon: User },
]

export function AppLayout() {
  const location = useLocation()
  const immersive = useWorkoutStore((s) => s.immersive)
  const hideTabs =
    immersive || location.pathname.startsWith('/workout') || location.pathname.startsWith('/setup')

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--sr-bg-base)]" data-tabs={hideTabs ? '0' : '1'}>
      {!hideTabs && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9999] focus:rounded-[var(--sr-radius-md)] focus:bg-[var(--sr-bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--sr-text-primary)] focus:shadow-[var(--sr-shadow-card)]"
        >
          {pl.skipToMain}
        </a>
      )}
      <main
        id="main-content"
        className={cn(
          'flex min-h-0 flex-1 flex-col transition-[padding] duration-200 motion-reduce:transition-none',
          !hideTabs && 'safe-header',
          !hideTabs && 'pb-[calc(5rem+env(safe-area-inset-bottom))]',
        )}
      >
        <Outlet />
      </main>
      <nav
        className={cn(
          'fixed bottom-0 left-0 right-0 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]/95 backdrop-blur-md safe-bottom shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.12)] transition-transform duration-200 motion-reduce:transition-none',
          hideTabs ? 'pointer-events-none translate-y-full' : 'translate-y-0',
        )}
        style={{ zIndex: Z_TAB_BAR }}
        aria-label={pl.mainNav}
        aria-hidden={hideTabs}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 py-1.5">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                tabIndex={hideTabs ? -1 : undefined}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate(8)
                  }
                }}
                className={cn(
                  'relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-[var(--sr-radius-lg)] px-1.5 py-1.5 text-xs transition-all duration-200 motion-reduce:transition-none active:scale-[0.97]',
                  FOCUS_RING,
                  active
                    ? 'font-semibold text-[var(--sr-brand-primary)]'
                    : 'font-medium text-[var(--sr-text-muted)] hover:text-[var(--sr-text-secondary)]',
                )}
              >
                {/* Pill background — smooth fade in/out */}
                <span
                  className={cn(
                    'absolute inset-0 rounded-[var(--sr-radius-lg)] bg-[var(--sr-brand-primary-muted)] transition-opacity duration-200 motion-reduce:transition-none',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                  aria-hidden
                />
                <Icon
                  size={20}
                  strokeWidth={active ? 2.5 : 2}
                  className="relative shrink-0"
                  aria-hidden
                />
                <span className="relative max-w-full truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
