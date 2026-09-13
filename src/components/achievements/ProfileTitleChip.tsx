import { Crown } from 'lucide-react'
import { getProfileTitle, titleRarity } from '@/lib/achievements/titles'
import { cn } from '@/lib/utils'

/**
 * Public profile title — small label under/next to the display name.
 * Renders nothing when the profile has no title (or the id isn't title-eligible
 * — defensive against stale/forged ids in remote data).
 */
export function ProfileTitleChip({
  achievementId,
  className,
}: {
  achievementId: string | null | undefined
  className?: string
}) {
  const title = getProfileTitle(achievementId)
  if (!title) return null
  const rarity = titleRarity(achievementId)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 sr-text-caption font-semibold',
        rarity === 'legendary'
          ? 'text-[var(--sr-warning)]'
          : rarity === 'rare'
            ? 'text-[var(--sr-info)]'
            : 'text-[var(--sr-text-secondary)]',
        className,
      )}
    >
      {rarity === 'legendary' && <Crown size={11} aria-hidden className="shrink-0" />}
      {title}
    </span>
  )
}
