import { useEffect, useState } from 'react'
import { Dumbbell, Flame, Repeat, Clock } from 'lucide-react'
import { buildAchievementSnapshot, emptyImpact } from '@/lib/achievements/snapshot'
import type { AchievementSnapshot } from '@/lib/achievements/types'
import { SkeletonCard } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

type StatItem = {
  icon: typeof Dumbbell
  label: string
  value: string
}

export function ProfileStats() {
  const [snap, setSnap] = useState<AchievementSnapshot | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = (force = false) => {
    void buildAchievementSnapshot({ impact: emptyImpact(), force })
      .then((s) => {
        setSnap(s)
        setLoaded(true)
      })
      .catch(() => undefined)
  }

  useEffect(() => {
    load()
    // Refresh when page becomes visible (user returns from workout)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load(true)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const items: StatItem[] = snap
    ? [
        {
          icon: Dumbbell,
          label: pl.profileStatsSessions,
          value: String(snap.completedCount),
        },
        {
          icon: Flame,
          label: pl.profileStatsStreak,
          value: snap.streakWeeks > 0 ? pl.profileStatsStreakWeeks(snap.streakWeeks) : pl.profileStatsEmpty,
        },
        {
          icon: Repeat,
          label: pl.profileStatsReps,
          value: snap.totalRepsAllTime > 0
            ? pl.profileStatsRepsValue(snap.totalRepsAllTime)
            : pl.profileStatsEmpty,
        },
        {
          icon: Clock,
          label: pl.profileStatsBestStreak,
          value: snap.bestStreakWeeks > 0
            ? pl.profileStatsStreakWeeks(snap.bestStreakWeeks)
            : pl.profileStatsEmpty,
        },
      ]
    : []

  if (!loaded) {
    return <SkeletonCard className="min-h-[7.5rem]" />
  }

  // One card, 2×2 cells with hairline dividers — same data as before, but
  // without four separate card chrome around every number.
  return (
    <div className="grid grid-cols-2 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cn(
            'flex items-center gap-3 px-3.5 py-3',
            i % 2 === 1 && 'border-l border-[var(--sr-border-subtle)]',
            i >= 2 && 'border-t border-[var(--sr-border-subtle)]',
          )}
        >
          <item.icon size={18} strokeWidth={1.75} className="shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
          <div className="min-w-0">
            <p className="sr-text-body-sm font-bold tabular-nums leading-tight text-[var(--sr-text-primary)]">
              {item.value}
            </p>
            <p className="sr-text-caption text-[var(--sr-text-muted)]">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
