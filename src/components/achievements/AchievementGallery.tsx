import { useEffect, useMemo, useState } from 'react'
import { ACHIEVEMENT_CATALOG } from '@/lib/achievements/catalog'
import type {
  AchievementId,
  AchievementSnapshot,
  AchievementTrack,
  LocalAchievementUnlock,
} from '@/lib/achievements/types'
import { achievementTitle } from '@/lib/achievements/copy'
import { buildAchievementSnapshot, emptyImpact } from '@/lib/achievements/snapshot'
import { AchievementTile } from './AchievementTile'
import { AchievementDetailSheet } from './AchievementDetailSheet'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { markUnlockSeen } from '@/lib/achievements/store'

type Filter = 'all' | 'unlocked'

export function AchievementGallery({
  unlocks,
  inProgress,
  onUnlocksChange,
}: {
  unlocks: LocalAchievementUnlock[]
  inProgress: { id: AchievementId; current: number; target: number }[]
  onUnlocksChange?: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [track, setTrack] = useState<AchievementTrack | 'all'>('all')
  const [detailId, setDetailId] = useState<AchievementId | null>(null)
  const [snap, setSnap] = useState<AchievementSnapshot | null>(null)

  useEffect(() => {
    void buildAchievementSnapshot({ impact: emptyImpact() }).then(setSnap).catch(() => undefined)
  }, [])

  const byId = useMemo(() => new Map(unlocks.map((u) => [u.id, u])), [unlocks])

  const visible = ACHIEVEMENT_CATALOG.filter((def) => {
    if (track !== 'all' && def.track !== track) return false
    const unlocked = byId.has(def.id)
    if (filter === 'unlocked' && !unlocked) return false
    return true
  })

  const detailDef = detailId ? ACHIEVEMENT_CATALOG.find((d) => d.id === detailId) : null
  const detailUnlock = detailId ? byId.get(detailId) : undefined

  async function openDetail(id: AchievementId) {
    setDetailId(id)
    const row = byId.get(id)
    if (row && !row.seenAt) {
      await markUnlockSeen(id)
      onUnlocksChange?.()
    }
  }

  return (
    <div className="space-y-4">
      <SegmentedControl
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        options={[
          { value: 'all', label: pl.achievementsFilterAll },
          { value: 'unlocked', label: pl.achievementsFilterUnlocked },
        ]}
      />

      <div className="flex flex-wrap gap-2" role="group" aria-label={pl.achievementsTitle}>
        {(
          [
            ['all', pl.achievementsFilterAll],
            ['training', pl.achievementsTrackTraining],
            ['habit', pl.achievementsTrackHabit],
            ['catalog', pl.achievementsTrackCatalog],
            ['legend', pl.achievementsTrackLegend],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTrack(value)}
            aria-pressed={track === value}
            className={cn(
              FOCUS_RING,
              'min-h-9 rounded-[var(--sr-radius-md)] border px-3 py-1.5 sr-text-caption',
              track === value
                ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-text-primary)]'
                : 'border-[var(--sr-border-subtle)] text-[var(--sr-text-secondary)]',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {inProgress.length > 0 && filter === 'all' && track === 'all' && (
        <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">{pl.achievementsInProgress}</p>
          <ul className="mt-2 space-y-3">
            {inProgress.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={cn(FOCUS_RING, 'flex w-full flex-col gap-1.5 rounded-[var(--sr-radius-sm)] text-left')}
                  onClick={() => void openDetail(p.id)}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                      {achievementTitle(p.id)}
                    </span>
                    <span className="tabular-nums sr-text-caption text-[var(--sr-text-secondary)]">
                      {pl.achievementsProgress(p.current, p.target)}
                    </span>
                  </span>
                  <span
                    className="h-1 overflow-hidden rounded-full bg-[var(--sr-bg-muted)]"
                    aria-hidden
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--sr-brand-primary)]"
                      style={{
                        width: `${Math.min(100, Math.round((p.current / p.target) * 100))}%`,
                      }}
                    />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState
          title={filter === 'unlocked' ? pl.achievementsEmptyUnlocked : pl.achievementsEmpty}
          description={
            filter === 'unlocked' ? pl.achievementsEmptyUnlockedHint : pl.achievementsEmptyHint
          }
        />
      ) : (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {visible.map((def) => {
            const unlock = byId.get(def.id)
            return (
              <AchievementTile
                key={def.id}
                def={def}
                unlocked={Boolean(unlock)}
                tierLevel={unlock?.tierLevel}
                highlight={Boolean(unlock && !unlock?.seenAt)}
                onClick={() => void openDetail(def.id)}
              />
            )
          })}
        </div>
      )}

      {detailDef && (
        <AchievementDetailSheet
          open
          def={detailDef}
          unlock={detailUnlock}
          snapshot={snap ?? undefined}
          progress={
            inProgress.find((p) => p.id === detailDef.id) ??
            undefined
          }
          onClose={() => setDetailId(null)}
        />
      )}
    </div>
  )
}
