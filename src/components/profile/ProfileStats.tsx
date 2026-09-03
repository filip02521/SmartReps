import { useEffect, useState } from 'react'
import { Dumbbell, Flame, Repeat, Clock } from 'lucide-react'
import { buildAchievementSnapshot, emptyImpact } from '@/lib/achievements/snapshot'
import type { AchievementSnapshot } from '@/lib/achievements/types'
import { SkeletonCard } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'

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
    return (
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} className="min-h-[5.5rem]" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center gap-1.5 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-3.5 text-center"
        >
          <item.icon size={20} strokeWidth={1.75} className="text-[var(--sr-brand-primary)]" aria-hidden />
          <p className="sr-text-h3 tabular-nums text-[var(--sr-text-primary)]">{item.value}</p>
          <p className="sr-text-caption text-[var(--sr-text-muted)]">{item.label}</p>
        </div>
      ))}
    </div>
  )
}
