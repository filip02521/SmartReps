import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Activity, BarChart3, List, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { useWorkoutStore } from '@/stores/workout-store'
import { useUnseenAchievements } from '@/hooks/useUnseenAchievements'
import { FOCUS_RING, Z_TAB_BAR } from '@/lib/ui-chrome'

export function AppLayout() {
  const location = useLocation()
  const immersive = useWorkoutStore((s) => s.immersive)
  const t = useT()
  const unseenAchievements = useUnseenAchievements()
  const tabs = [
    { to: '/', label: t.navWorkout, icon: Activity, badge: 0 },
    { to: '/progress', label: t.navProgress, icon: BarChart3, badge: unseenAchievements },
    { to: '/plans', label: t.navPlans, icon: List, badge: 0 },
    { to: '/profile', label: t.navProfile, icon: User, badge: 0 },
  ]
  const hideTabs =
    immersive || location.pathname.startsWith('/workout') || location.pathname.startsWith('/setup')

  // Move focus to main content on route change so screen-reader/keyboard users
  // don't get stranded on the previously-focused tab link.
  useEffect(() => {
    const main = document.getElementById('main-content')
    if (main) {
      main.focus({ preventScroll: true })
    }
  }, [location.pathname])

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--sr-bg-base)]" data-tabs={hideTabs ? '0' : '1'}>
      {!hideTabs && (
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[9999] focus:rounded-[var(--sr-radius-md)] focus:bg-[var(--sr-bg-elevated)] focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--sr-text-primary)] focus:shadow-[var(--sr-shadow-card)]"
        >
          {t.skipToMain}
        </a>
      )}
      <main
        id="main-content"
        tabIndex={-1}
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
          'fixed bottom-0 left-0 right-0 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]/95 backdrop-blur-md safe-bottom shadow-[var(--sr-shadow-nav)] transition-transform duration-200 motion-reduce:transition-none',
          hideTabs ? 'pointer-events-none translate-y-full' : 'translate-y-0',
        )}
        style={{ zIndex: Z_TAB_BAR }}
        aria-label={t.mainNav}
        aria-hidden={hideTabs}
      >
        <div className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 py-1.5">
          {tabs.map(({ to, label, icon: Icon, badge }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                tabIndex={hideTabs ? -1 : undefined}
                aria-current={active ? 'page' : undefined}
                aria-label={badge > 0 && to === '/progress' ? `${label} — ${t.navBadgeAria(badge)}` : undefined}
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
                <span className="relative">
                  <Icon
                    size={20}
                    strokeWidth={active ? 2.5 : 2}
                    className="relative shrink-0"
                    aria-hidden
                  />
                  {/* Badge — unseen achievements count */}
                  {badge > 0 && (
                    <span
                      className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--sr-brand-primary)] px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                      aria-hidden
                    >
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="relative max-w-full truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
