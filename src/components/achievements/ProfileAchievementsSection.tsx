import { useCallback, useEffect, useState } from 'react'
import { Crown } from 'lucide-react'
import { ProfileAchievementCase } from '@/components/achievements/ProfileAchievementCase'
import { ShowcasePickerSheet } from '@/components/achievements/ShowcasePickerSheet'
import { TitlePickerSheet } from '@/components/achievements/TitlePickerSheet'
import { AchievementDetailSheet } from '@/components/achievements/AchievementDetailSheet'
import { getAllUnlocks } from '@/lib/achievements/store'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import { getProfileTitle, isTitleId } from '@/lib/achievements/titles'
import { ProfileTitleChip } from '@/components/achievements/ProfileTitleChip'
import { buildAchievementSnapshot, emptyImpact } from '@/lib/achievements/snapshot'
import type {
  AchievementId,
  AchievementSnapshot,
  LocalAchievementUnlock,
} from '@/lib/achievements/types'
import { PageSection } from '@/components/ui/PageSection'
import { useAppStore } from '@/stores/app-store'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'

export function ProfileAchievementsSection() {
  const [unlocks, setUnlocks] = useState<LocalAchievementUnlock[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [titlePickerOpen, setTitlePickerOpen] = useState(false)
  const [detailId, setDetailId] = useState<AchievementId | null>(null)
  const [showcaseKey, setShowcaseKey] = useState(0)
  const [snap, setSnap] = useState<AchievementSnapshot | null>(null)
  const selectedTitle = useAppStore((s) => s.settings.selectedTitle)
  const currentTitle = isTitleId(selectedTitle) ? getProfileTitle(selectedTitle) : null

  const reload = useCallback(() => {
    void getAllUnlocks().then((rows) => {
      setUnlocks(rows)
      setLoaded(true)
    })
    void buildAchievementSnapshot({ impact: emptyImpact() }).then(setSnap).catch(() => undefined)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  if (!loaded) return null

  const detailDef = detailId ? ACHIEVEMENT_BY_ID[detailId] : null
  const detailUnlock = detailId ? unlocks.find((u) => u.id === detailId) : undefined

  return (
    <PageSection title={pl.achievementsProfileTitle}>
      <ProfileAchievementCase
        key={showcaseKey}
        unlocks={unlocks}
        onOpenDetail={setDetailId}
        onEditShowcase={() => setPickerOpen(true)}
      />
      <button
        type="button"
        onClick={() => setTitlePickerOpen(true)}
        className={`${FOCUS_RING} mt-3 flex w-full items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]`}
      >
        <Crown size={16} className="shrink-0 text-[var(--sr-warning)]" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {pl.profileTitleLabel}
          </span>
          {currentTitle ? (
            <ProfileTitleChip achievementId={selectedTitle} className="mt-0.5 truncate" />
          ) : (
            <span className="block truncate sr-text-caption text-[var(--sr-text-muted)]">
              {pl.profileTitleNone}
            </span>
          )}
        </span>
        <span className="shrink-0 sr-text-caption font-medium text-[var(--sr-brand-primary)]">
          {pl.profileTitleChange}
        </span>
      </button>
      <ShowcasePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        unlocks={unlocks}
        onSaved={() => setShowcaseKey((k) => k + 1)}
      />
      <TitlePickerSheet
        open={titlePickerOpen}
        onClose={() => setTitlePickerOpen(false)}
        unlocks={unlocks}
      />
      {detailDef && (
        <AchievementDetailSheet
          open={detailId != null}
          onClose={() => setDetailId(null)}
          def={detailDef}
          unlock={detailUnlock}
          snapshot={snap ?? undefined}
        />
      )}
    </PageSection>
  )
}
