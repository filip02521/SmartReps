import { ChevronRight, Heart, Star } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { FollowButton } from '@/components/follow/FollowManager'
import { pl } from '@/i18n/pl'
import type { CommunityPublicationRow } from '@/lib/community-api'
import { communityTagLabel } from '@/lib/community-labels'
import { snapshotDayCount, snapshotExerciseCount } from '@/lib/community-import'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import { useIsFollowing } from '@/hooks/useIsFollowing'

/** Compact inline star rating for catalog cards — shows filled stars for the
 *  rounded average plus the review count. Returns null when no reviews. */
function CardRating({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return null
  const rounded = Math.round(avg)
  const avgStr = avg.toFixed(1)
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={pl.communityRatingAria(avgStr, count)}
      title={pl.communityRatingAria(avgStr, count)}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn(
            'size-3',
            i < rounded
              ? 'fill-[var(--sr-warning)] text-[var(--sr-warning)]'
              : 'text-[var(--sr-text-muted)]',
          )}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-xs font-medium text-[var(--sr-text-secondary)]">
        {avgStr}
      </span>
      <span className="text-xs text-[var(--sr-text-muted)]">
        ({count})
      </span>
    </span>
  )
}

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
  /** Show follow author button (only for non-own published plans). */
  showFollow?: boolean
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
  showFollow,
}: Props) {
  const days = snapshotDayCount(row.snapshot_json)
  const exercises = snapshotExerciseCount(row.snapshot_json)
  const desc = row.description.trim()
  const canLike = Boolean(onLike)
  const isFollowing = useIsFollowing(showFollow ? row.author_id : null)

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
              <p className="min-w-0 flex-1 break-words font-semibold text-[var(--sr-text-primary)]">{row.title}</p>
              <div className="flex flex-wrap gap-1">
                {isOwn ? <Badge variant="default">{pl.communityYourPlan}</Badge> : null}
                {row.trained_count > 0 ? (
                  <Badge variant="success">{pl.communityTrainedBadge}</Badge>
                ) : null}
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
                    className="rounded-[var(--sr-radius-full)] bg-[var(--sr-bg-surface)] px-2 py-0.5 text-[11px] text-[var(--sr-text-muted)]"
                  >
                    {communityTagLabel(t)}
                  </span>
                ))}
              </div>
            ) : null}
            {/* Rating + likes + imports — static layout (no like button) */}
            {!canLike ? (
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--sr-text-muted)]">
                <CardRating avg={row.avg_rating} count={row.review_count} />
                <span className="inline-flex items-center gap-1">
                  <Heart className={cn('size-3.5', liked && 'fill-current')} aria-hidden />
                  <span>{row.like_count}</span>
                </span>
                {!compact ? (
                  <span>{pl.communityImports(row.import_count)}</span>
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--sr-text-muted)]">
            <CardRating avg={row.avg_rating} count={row.review_count} />
            {!compact ? <span>{pl.communityImports(row.import_count)}</span> : null}
          </div>
          <div className="flex items-center gap-2">
            {showFollow && isFollowing !== null && (
              <div onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
                <FollowButton
                  targetUserId={row.author_id}
                  initiallyFollowing={isFollowing}
                />
              </div>
            )}
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
        </div>
      ) : null}
    </div>
  )
}
