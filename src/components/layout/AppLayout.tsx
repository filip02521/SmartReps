import { Link, Outlet, useLocation } from 'react-router-dom'
import { Activity, BarChart3, List, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import { useWorkoutStore } from '@/stores/workout-store'

const tabs = [
  { to: '/', label: pl.navWorkout, icon: Activity },
  { to: '/progress', label: pl.navProgress, icon: BarChart3 },
  { to: '/plans', label: pl.navPlans, icon: List },
  { to: '/profile', label: pl.navProfile, icon: User },
]

export function AppLayout() {
  const location = useLocation()
  const immersive = useWorkoutStore((s) => s.immersive)
  const hideTabs = immersive || location.pathname.startsWith('/workout') || location.pathname.startsWith('/setup')

  return (
    <div className="flex min-h-full flex-col">
      <main className={cn('flex-1 min-h-0', !hideTabs && 'pb-[calc(5rem+env(safe-area-inset-bottom))]')}>
        <Outlet />
      </main>
      {!hideTabs && (
        <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] safe-bottom">
          <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
            {tabs.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to
              return (
                <Link
                  key={to}
                  to={to}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2 text-xs',
                    active ? 'text-[var(--sr-brand-primary)]' : 'text-[var(--sr-text-muted)]',
                  )}
                >
                  <Icon size={22} />
                  {label}
                </Link>
              )
            })}
          </div>
        </nav>
      )}
    </div>
  )
}
