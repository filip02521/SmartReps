import { useEffect, useState } from 'react'
import { ProfileAchievementRow } from '@/components/achievements/ProfileAchievementRow'
import { getAllUnlocks } from '@/lib/achievements/store'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import { PageSection } from '@/components/ui/PageSection'
import { pl } from '@/i18n/pl'

export function ProfileAchievementsSection() {
  const [unlocks, setUnlocks] = useState<LocalAchievementUnlock[]>([])

  useEffect(() => {
    void getAllUnlocks().then(setUnlocks)
  }, [])

  if (unlocks.length === 0) return null

  return (
    <PageSection title={pl.achievementsProfileTitle}>
      <ProfileAchievementRow unlocks={unlocks} />
    </PageSection>
  )
}
