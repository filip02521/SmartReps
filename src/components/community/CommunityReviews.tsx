import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Star, Trash2, Pencil, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { EmptyState, FeedbackBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { showToast } from '@/stores/toast-store'
import { useAppStore } from '@/stores/app-store'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { dateFnsLocale } from '@/lib/date-locale'
import {
  upsertCommunityReview,
  deleteCommunityReview,
  getCommunityReviewSummary,
  getMyCommunityReview,
  listCommunityReviews,
  type CommunityReview,
  type ReviewSummary,
  type ReviewWithAuthor,
} from '@/lib/community-reviews'

/* ─── StarRating — display + interactive ─── */

export function StarRating({
  value,
  onChange,
  size = 20,
  readOnly = false,
  ariaLabel,
}: {
  value: number
  onChange?: (rating: number) => void
  size?: number
  readOnly?: boolean
  ariaLabel?: string
}) {
  const [hover, setHover] = useState(0)
  const displayValue = hover || value
  const starRefs = useRef<(HTMLButtonElement | null)[]>([])

  const focusStar = (n: number) => {
    const el = starRefs.current[n - 1]
    if (el) el.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (readOnly || !onChange) return
    // Navigate based on current value, not focused star
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = Math.min(5, value + 1)
      onChange(next)
      focusStar(next)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      const prev = Math.max(1, value - 1)
      onChange(prev)
      focusStar(prev)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(1)
      focusStar(1)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(5)
      focusStar(5)
    }
  }

  return (
    <div
      className="flex items-center gap-0.5"
      role={readOnly ? 'img' : 'radiogroup'}
      aria-label={ariaLabel ?? pl.communityReviewStars(value)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= displayValue
        return (
          <button
            key={star}
            ref={(el) => { starRefs.current[star - 1] = el }}
            type="button"
            role={readOnly ? undefined : 'radio'}
            disabled={readOnly}
            tabIndex={readOnly ? -1 : (value === 0 ? (star === 1 ? 0 : -1) : (star === value ? 0 : -1))}
            className={cn(
              FOCUS_RING,
              'flex items-center justify-center rounded-[var(--sr-radius-sm)] transition-transform',
              !readOnly && 'hover:scale-110 active:scale-95 cursor-pointer',
              readOnly && 'cursor-default',
            )}
            style={{ minWidth: size + 8, minHeight: size + 8 }}
            onClick={() => !readOnly && onChange?.(star)}
            onMouseEnter={() => !readOnly && setHover(star)}
            onMouseLeave={() => !readOnly && setHover(0)}
            onFocus={() => !readOnly && setHover(star)}
            onBlur={() => !readOnly && setHover(0)}
            onKeyDown={handleKeyDown}
            aria-label={pl.communityReviewStars(star)}
            aria-checked={!readOnly && star === value}
          >
            <Star
              size={size}
              className={cn(
                filled
                  ? 'fill-[var(--sr-warning)] text-[var(--sr-warning)]'
                  : 'fill-transparent text-[var(--sr-border-strong)]',
              )}
              strokeWidth={2}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}

/* ─── Review summary — avg + count ─── */

export function ReviewSummaryBar({ summary }: { summary: ReviewSummary | null }) {
  if (!summary || summary.review_count === 0) return null
  const avg = Math.round(summary.avg_rating * 10) / 10
  return (
    <div className="flex items-center gap-2">
      <StarRating value={Math.round(summary.avg_rating)} readOnly size={16} />
      <span className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
        {avg.toFixed(1)}
      </span>
      <span className="sr-text-caption text-[var(--sr-text-muted)]">
        ({pl.communityReviewsCount(summary.review_count)})
      </span>
    </div>
  )
}

/* ─── Review form sheet — create or edit ─── */

export function ReviewFormSheet({
  open,
  onClose,
  publicationId,
  existingReview,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  publicationId: string
  existingReview: CommunityReview | null
  onSaved: () => void
}) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (open) {
      setRating(existingReview?.rating ?? 0)
      setComment(existingReview?.comment ?? '')
      setError('')
    }
  }, [open, existingReview])

  const handleSubmit = useCallback(async () => {
    if (rating < 1) return
    setBusy(true)
    setError('')
    try {
      await upsertCommunityReview({ publicationId, rating, comment })
      if (!mountedRef.current) return
      showToast(pl.communityReviewDone, 'success')
      onSaved()
      onClose()
    } catch (e) {
      if (!mountedRef.current) return
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'self_review_forbidden') setError(pl.communityReviewSelfForbidden)
      else if (msg === 'comment_too_long') setError(pl.communityReviewCommentTooLong)
      else if (msg === 'not_authenticated') setError(pl.communityReviewLoginRequired)
      else setError(pl.communityErrorGeneric)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [rating, comment, publicationId, onSaved, onClose])

  const isEdit = Boolean(existingReview)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? pl.communityReviewEdit : pl.communityReviewAdd}
    >
      <div className="flex flex-col gap-4">
        {error && <FeedbackBanner variant="error" message={error} />}

        {/* Rating */}
        <div className="flex flex-col gap-2">
          <label htmlFor="review-rating" className="sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.communityReviewRatingLabel}
          </label>
          <StarRating
            value={rating}
            onChange={setRating}
            size={32}
            ariaLabel={pl.communityReviewRatingLabel}
          />
          {rating < 1 && (
            <p id="review-rating-hint" className="sr-text-caption text-[var(--sr-text-muted)]">
              {pl.communityReviewRatingLabel}
            </p>
          )}
        </div>

        {/* Comment */}
        <div className="flex flex-col gap-2">
          <label htmlFor="review-comment" className="sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.communityReviewCommentLabel}
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder={pl.communityReviewCommentPlaceholder}
            rows={3}
            aria-describedby="review-comment-counter"
            className={cn(
              FOCUS_RING,
              'w-full resize-none rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 sr-text-body-sm text-[var(--sr-text-primary)] placeholder:text-[var(--sr-text-muted)]',
            )}
            maxLength={500}
          />
          <span id="review-comment-counter" className="text-right sr-text-caption text-[var(--sr-text-muted)]">
            {comment.length}/500
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <Button fullWidth disabled={busy || rating < 1} onClick={handleSubmit}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {isEdit ? pl.communityReviewUpdate : pl.communityReviewSubmit}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {pl.cancel}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/* ─── Review list item ─── */

function ReviewItem({
  review,
  isOwn,
  onEdit,
  onDelete,
}: {
  review: ReviewWithAuthor
  isOwn: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dateStr = format(new Date(review.created_at), 'd MMM yyyy', {
    locale: dateFnsLocale(),
  })

  return (
    <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <StarRating value={review.rating} readOnly size={14} />
            <span className="sr-text-caption text-[var(--sr-text-muted)]">{dateStr}</span>
          </div>
          <p className="mt-1 sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
            {review.author_display_name || pl.communityReviewAnonymous}
          </p>
        </div>
        {isOwn && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              className={cn(FOCUS_RING, 'flex h-8 w-8 items-center justify-center rounded-[var(--sr-radius-sm)] text-[var(--sr-text-muted)] hover:text-[var(--sr-text-primary)] hover:bg-[var(--sr-bg-surface)] transition-colors')}
              onClick={onEdit}
              aria-label={pl.communityReviewEdit}
            >
              <Pencil size={14} aria-hidden />
            </button>
            <button
              type="button"
              className={cn(FOCUS_RING, 'flex h-8 w-8 items-center justify-center rounded-[var(--sr-radius-sm)] text-[var(--sr-text-muted)] hover:text-[var(--sr-error)] hover:bg-[var(--sr-bg-surface)] transition-colors')}
              onClick={() => setConfirmDelete(true)}
              aria-label={pl.communityReviewDelete}
            >
              <Trash2 size={14} aria-hidden />
            </button>
          </div>
        )}
      </div>
      {review.comment && (
        <p className="mt-2 text-pretty sr-text-body-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {review.comment}
        </p>
      )}
      {confirmDelete && (
        <ConfirmSheet
          title={pl.communityReviewDeleteConfirm}
          message={pl.communityReviewDeleteConfirmMessage}
          confirmLabel={pl.communityReviewDelete}
          variant="danger"
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}

/* ─── Main reviews section — used in CommunityPublicationView ─── */

export function CommunityReviewsSection({
  publicationId,
  authorId,
}: {
  publicationId: string
  authorId: string
}) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<ReviewWithAuthor[]>([])
  const [myReview, setMyReview] = useState<CommunityReview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const reload = useCallback(async () => {
    const reqId = ++requestIdRef.current
    setLoadError(false)
    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!mountedRef.current || reqId !== requestIdRef.current) return
      const userId = authData.user?.id ?? null
      setCurrentUserId(userId)

      const [sum, list, mine] = await Promise.all([
        getCommunityReviewSummary(publicationId),
        listCommunityReviews(publicationId),
        userId ? getMyCommunityReview(publicationId) : Promise.resolve(null),
      ])
      if (!mountedRef.current || reqId !== requestIdRef.current) return
      setSummary(sum)
      setReviews(list)
      setMyReview(mine)
    } catch {
      if (mountedRef.current && reqId === requestIdRef.current) setLoadError(true)
    } finally {
      if (mountedRef.current && reqId === requestIdRef.current) setLoading(false)
    }
  }, [publicationId])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    void reload()
  }, [reload])

  const handleDelete = useCallback(async () => {
    setBusy(true)
    try {
      await deleteCommunityReview(publicationId)
      showToast(pl.communityReviewDeleted, 'success')
      await reload()
    } catch {
      showToast(pl.communityErrorGeneric, 'error')
    } finally {
      setBusy(false)
    }
  }, [publicationId, reload])

  const isAuthor = currentUserId === authorId
  const isLoggedIn = currentUserId !== null
  const canReview = onboardingComplete && !isAuthor && isLoggedIn

  // Filter out current user's review from the public list (shown separately)
  const otherReviews = reviews.filter((r) => r.user_id !== currentUserId)
  const hasAnyContent = myReview || otherReviews.length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 size={20} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <h3 className="sr-text-h3">{pl.communityReviewsTitle}</h3>
        <FeedbackBanner variant="error" message={pl.communityErrorGeneric} />
        <Button size="sm" variant="ghost" onClick={() => void reload()}>
          {pl.retry}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header — title + summary + add button */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="sr-text-h3">{pl.communityReviewsTitle}</h3>
          {summary && summary.review_count > 0 && (
            <div className="mt-1">
              <ReviewSummaryBar summary={summary} />
            </div>
          )}
        </div>
        {canReview && (
          <Button
            size="sm"
            variant={myReview ? 'secondary' : 'primary'}
            onClick={() => setFormOpen(true)}
            disabled={busy}
          >
            {myReview ? pl.communityReviewEdit : pl.communityReviewAdd}
          </Button>
        )}
      </div>

      {/* Login prompt for not-logged-in users */}
      {onboardingComplete && !isLoggedIn && !isAuthor && (
        <p className="sr-text-caption text-[var(--sr-text-muted)]">
          {pl.communityReviewLoginRequired}
        </p>
      )}

      {/* Your review — highlighted at top */}
      {myReview && (
        <div className="rounded-[var(--sr-radius-md)] border-2 border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] p-3">
          <p className="mb-2 sr-text-overline text-[var(--sr-brand-primary)]">
            {pl.communityReviewYourReview}
          </p>
          <ReviewItem
            review={{
              ...myReview,
              author_display_name: '',
            }}
            isOwn
            onEdit={() => setFormOpen(true)}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* All reviews */}
      {!hasAnyContent ? (
        <EmptyState title={pl.communityReviewsEmpty} />
      ) : (
        <div className="space-y-2">
          {otherReviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              isOwn={false}
              onEdit={() => {}}
              onDelete={() => {}}
            />
          ))}
        </div>
      )}

      {/* Review form sheet */}
      {formOpen && (
        <ReviewFormSheet
          open={formOpen}
          onClose={() => setFormOpen(false)}
          publicationId={publicationId}
          existingReview={myReview}
          onSaved={reload}
        />
      )}
    </div>
  )
}
