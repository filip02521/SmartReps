import { useCallback, useEffect, useState } from 'react'
import { ProfileAchievementCase } from '@/components/achievements/ProfileAchievementCase'
import { ShowcasePickerSheet } from '@/components/achievements/ShowcasePickerSheet'
import { AchievementDetailSheet } from '@/components/achievements/AchievementDetailSheet'
import { getAllUnlocks } from '@/lib/achievements/store'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import type { AchievementId, LocalAchievementUnlock } from '@/lib/achievements/types'
import { PageSection } from '@/components/ui/PageSection'
import { pl } from '@/i18n/pl'

export function ProfileAchievementsSection() {
  const [unlocks, setUnlocks] = useState<LocalAchievementUnlock[]>([])
  const [loaded, setLoaded] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [detailId, setDetailId] = useState<AchievementId | null>(null)
  const [showcaseKey, setShowcaseKey] = useState(0)

  const reload = useCallback(() => {
    void getAllUnlocks().then((rows) => {
      setUnlocks(rows)
      setLoaded(true)
    })
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
      <ShowcasePickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        unlocks={unlocks}
        onSaved={() => setShowcaseKey((k) => k + 1)}
      />
      {detailDef && (
        <AchievementDetailSheet
          open={detailId != null}
          onClose={() => setDetailId(null)}
          def={detailDef}
          unlock={detailUnlock}
        />
      )}
    </PageSection>
  )
}
