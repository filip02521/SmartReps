import { useNavigate } from 'react-router-dom'
import { ACHIEVEMENT_BY_ID } from '@/lib/achievements/catalog'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import { AchievementTile } from './AchievementTile'
import { pl } from '@/i18n/pl'
import { Button } from '@/components/ui/Button'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

export function ProfileAchievementRow({ unlocks }: { unlocks: LocalAchievementUnlock[] }) {
  const navigate = useNavigate()
  const recent = [...unlocks]
    .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, 3)

  if (recent.length === 0) return null

  const goAll = () => navigate('/progress?tab=achievements')

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.achievementsProfileHint}
        </p>
        <Button variant="ghost" size="sm" className={cn(FOCUS_RING, 'shrink-0')} onClick={goAll}>
          {pl.achievementsProfileSeeAll}
        </Button>
      </div>
      <div className="flex gap-3">
        {recent.map((u) => {
          const def = ACHIEVEMENT_BY_ID[u.id]
          if (!def) return null
          return (
            <AchievementTile
              key={u.id}
              def={def}
              unlocked
              size="sm"
              showCaption
              onClick={goAll}
            />
          )
        })}
      </div>
    </div>
  )
}
