import { ChevronRight, Heart } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { pl } from '@/i18n/pl'
import type { CommunityPublicationRow } from '@/lib/community-api'
import { communityTagLabel } from '@/lib/community-labels'
import { snapshotDayCount, snapshotExerciseCount } from '@/lib/community-import'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

type Props = {
  row: CommunityPublicationRow
  onClick: () => void
  /** Show published/unpublished badge (author list). */
  showStatus?: boolean
  compact?: boolean
  liked?: boolean
  likeDisabled?: boolean
  onLike?: () => void
  isOwn?: boolean
}

export function CommunityPlanCard({
  row,
  onClick,
  showStatus,
  compact,
  liked,
  likeDisabled,
  onLike,
  isOwn,
}: Props) {
  const days = snapshotDayCount(row.snapshot_json)
  const exercises = snapshotExerciseCount(row.snapshot_json)
  const desc = row.description.trim()
  const canLike = Boolean(onLike)

  return (
    <div
      className={cn(
        'relative w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
        compact ? 'px-3 py-2.5' : 'p-4',
      )}
    >
      <button
        type="button"
        className={cn(FOCUS_RING, 'w-full text-left')}
        onClick={onClick}
      >
        <div className="flex items-start gap-2 pr-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-[var(--sr-text-primary)]">{row.title}</p>
              <div className="flex flex-wrap gap-1">
                {isOwn ? <Badge variant="default">{pl.communityYourPlan}</Badge> : null}
                {showStatus ? (
                  <Badge variant={row.status === 'published' ? 'success' : 'default'}>
                    {row.status === 'published'
                      ? pl.communityStatusPublished
                      : pl.communityStatusUnpublished}
                  </Badge>
                ) : null}
              </div>
            </div>
            <p className="mt-0.5 text-sm text-[var(--sr-text-muted)]">
              {pl.communityByAuthor(row.author_display_name)}
              {' · '}
              {pl.communityDaysExercises(days, exercises)}
            </p>
            {!compact && desc ? (
              <p className="mt-1.5 line-clamp-2 text-sm text-[var(--sr-text-secondary)]">{desc}</p>
            ) : null}
            {!compact && row.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {row.tags.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-[var(--sr-radius-full)] bg-[var(--sr-bg-muted)] px-2 py-0.5 text-[11px] text-[var(--sr-text-muted)]"
                  >
                    {communityTagLabel(t)}
                  </span>
                ))}
              </div>
            ) : null}
            {!canLike ? (
              <div className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--sr-text-muted)]">
                <Heart className={cn('size-3.5', liked && 'fill-current')} aria-hidden />
                <span>{row.like_count}</span>
                {!compact ? (
                  <span className="ml-2">{pl.communityImports(row.import_count)}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <ChevronRight
            className="mt-0.5 size-5 shrink-0 text-[var(--sr-text-muted)]"
            aria-hidden
          />
        </div>
      </button>

      {canLike ? (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-[var(--sr-border-subtle)] pt-2">
          <span className="text-xs text-[var(--sr-text-muted)]">
            {!compact ? pl.communityImports(row.import_count) : null}
          </span>
          <button
            type="button"
            className={cn(
              FOCUS_RING,
              'inline-flex min-h-12 min-w-12 items-center justify-center gap-1.5 rounded-[var(--sr-radius-md)] px-2.5 text-sm font-medium',
              liked
                ? 'text-[var(--sr-brand-primary)]'
                : 'text-[var(--sr-text-secondary)]',
              likeDisabled && 'opacity-50',
            )}
            disabled={likeDisabled}
            aria-pressed={liked}
            aria-label={liked ? pl.communityUnlike : pl.communityLike}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onLike?.()
            }}
          >
            <Heart className={cn('size-4', liked && 'fill-current')} aria-hidden />
            <span>{row.like_count}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
