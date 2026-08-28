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
    <div className={cn('flex min-h-dvh flex-col bg-[var(--sr-bg-base)]', hideTabs && 'h-dvh')} data-tabs={hideTabs ? '0' : '1'}>
      <main
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
          'fixed bottom-0 left-0 right-0 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] safe-bottom transition-transform duration-200 motion-reduce:transition-none',
          hideTabs ? 'pointer-events-none translate-y-full' : 'translate-y-0',
        )}
        style={{ zIndex: Z_TAB_BAR }}
        aria-label={pl.mainNav}
        aria-hidden={hideTabs}
      >
        <div className="mx-auto flex max-w-lg justify-around px-1 py-1">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to
            return (
              <Link
                key={to}
                to={to}
                tabIndex={hideTabs ? -1 : undefined}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-medium',
                  FOCUS_RING,
                  active ? 'text-[var(--sr-brand-primary)]' : 'text-[var(--sr-text-muted)]',
                )}
              >
                {active && (
                  <span
                    className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-[var(--sr-brand-primary)]"
                    aria-hidden
                  />
                )}
                <Icon size={22} strokeWidth={active ? 2.5 : 2} />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
