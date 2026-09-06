import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Sheet } from '@/components/ui/Sheet'
import { FeedbackBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { CustomPlan } from '@/lib/exercise-model'
import { buildCommunitySnapshot } from '@/lib/community-snapshot'
import {
  fetchMyPublicationForPlan,
  publishCommunityPlan,
  type CommunityPublicationRow,
} from '@/lib/community-api'
import { getMyPublicProfile } from '@/lib/follow-system'
import { communitySlugFromTitle } from '@/lib/slugify'
import { generateId } from '@/lib/utils'
import {
  COMMUNITY_TAGS,
  type CommunityTag,
  normalizeCommunityTags,
  isCommunityTag,
} from '@/data/community-tags'
import { communityTagLabel } from '@/lib/community-labels'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { useOnline } from '@/hooks/useOnline'
import { clearCommunityListCache } from '@/lib/community-list-cache'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

type Props = {
  plan: CustomPlan | null
  open: boolean
  onClose: () => void
  onPublished?: () => void
}

export function PublishCommunitySheet({ plan, open, onClose, onPublished }: Props) {
  const navigate = useNavigate()
  const online = useOnline()
  const displayName = useAppStore((s) => s.settings.displayName ?? '')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<CommunityTag[]>([])
  const [busy, setBusy] = useState(false)
  const [existing, setExisting] = useState<CommunityPublicationRow | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(false)
  const [hasPublicProfile, setHasPublicProfile] = useState(false)
  const [profileChecked, setProfileChecked] = useState(false)

  const isUpdate = existing != null

  useEffect(() => {
    if (!open || !plan) return
    setTitle(plan.name)
    setDescription(plan.description || '')
    setTags([])
    setExisting(null)
    setProfileChecked(false)
    let cancelled = false
    setLoadingExisting(true)
    // Check public profile in parallel with existing publication
    void getMyPublicProfile()
      .then((profile) => {
        if (cancelled) return
        setHasPublicProfile(Boolean(profile?.is_public))
      })
      .catch(() => {
        if (cancelled) return
        setHasPublicProfile(false)
      })
      .finally(() => {
        if (!cancelled) setProfileChecked(true)
      })
    void fetchMyPublicationForPlan(plan.id)
      .then((pub) => {
        if (cancelled || !pub) return
        setExisting(pub)
        setTitle(pub.title)
        setDescription(pub.description)
        setTags(pub.tags.filter(isCommunityTag))
      })
      .catch(() => {
        /* first publish */
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, plan])

  const preview = useMemo(() => {
    if (!plan) return null
    const days = plan.days.length
    const exercises = plan.days.reduce((n, d) => n + d.exercises.length, 0)
    return pl.communityDaysExercises(days, exercises)
  }, [plan])

  function toggleTag(tag: CommunityTag) {
    setTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag)
      if (prev.length >= 3) return prev
      return [...prev, tag]
    })
  }

  async function submit() {
    if (!plan || !online) {
      showToast(pl.communityNeedOnline, 'info')
      return
    }
    if (!hasPublicProfile) {
      showToast(pl.communityPublishNeedPublicProfile, 'warning')
      return
    }
    if (plan.status !== 'active') {
      showToast(pl.communityPublishNeedActive, 'error')
      return
    }
    const authorName = displayName.trim()
    if (!authorName) {
      showToast(pl.communityPublishNeedName, 'error')
      return
    }
    if (!title.trim()) {
      showToast(pl.communityPublishNeedTitle, 'error')
      return
    }

    setBusy(true)
    try {
      const exercises = await db.exercises.toArray()
      const byId = new Map(exercises.map((e) => [e.id, e]))
      const built = buildCommunitySnapshot(plan, byId)
      if (!built.ok) {
        const first = built.errors[0]
        if (first?.code === 'missing_exercise') {
          showToast(pl.communityPublishMissingExercise, 'error')
        } else {
          showToast(pl.communityPublishInvalidPlan, 'error')
        }
        return
      }

      const slug =
        existing?.slug ?? communitySlugFromTitle(title.trim() || plan.name, generateId())

      await publishCommunityPlan({
        sourceCustomPlanId: plan.id,
        title: title.trim() || plan.name,
        description: description.trim().slice(0, 1500),
        tags: normalizeCommunityTags(tags),
        snapshot: built.snapshot,
        slug,
        authorDisplayName: authorName,
      })
      clearCommunityListCache()
      showToast(isUpdate ? pl.communityPublishUpdated : pl.communityPublishDone, 'success')
      onPublished?.()
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('rate_limited')) showToast(pl.communityRateLimited, 'warning')
      else if (msg.includes('public_profile_required')) {
        showToast(pl.communityPublishNeedPublicProfile, 'warning')
        setHasPublicProfile(false)
      }
      else showToast(pl.communityErrorGeneric, 'error')
    } finally {
      setBusy(false)
    }
  }

  const formDisabled = busy || loadingExisting || !online || !hasPublicProfile

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isUpdate ? pl.communityPublishUpdate : pl.communityPublish}
    >
      <div className="space-y-3 p-4 pb-6">
        {!online && <FeedbackBanner variant="info" message={pl.communityNeedOnline} />}

        {/* Public profile required blocker */}
        {online && profileChecked && !hasPublicProfile && (
          <div className="space-y-3">
            <FeedbackBanner
              variant="warning"
              message={pl.communityPublishNeedPublicProfile}
            />
            <p className="text-sm text-[var(--sr-text-secondary)]">
              {pl.communityPublishNeedPublicProfileHint}
            </p>
            <Button
              fullWidth
              onClick={() => {
                onClose()
                navigate('/profile')
              }}
            >
              {pl.communityPublishGoToProfile}
            </Button>
          </div>
        )}

        {/* Form — only when public profile is set (or still loading) */}
        {(!profileChecked || hasPublicProfile) && (
          <>
            <p className="text-sm text-[var(--sr-text-secondary)]">{pl.communityPublishHint}</p>
            {preview ? (
              <p className="text-xs font-medium text-[var(--sr-text-muted)]">{preview}</p>
            ) : null}

        <TextField
          id="community-title"
          label={pl.communityPublishTitle}
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 80))}
          disabled={formDisabled}
          maxLength={80}
          hint={pl.communityCharCount(title.length, 80)}
        />
        <div>
          <label
            htmlFor="community-description"
            className="block text-sm font-medium text-[var(--sr-text-secondary)]"
          >
            {pl.communityPublishDescription}
          </label>
          <textarea
            id="community-description"
            className={cn(
              FOCUS_RING,
              'mt-2 min-h-24 w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-base text-[var(--sr-text-primary)]',
              formDisabled && 'opacity-60',
            )}
            value={description}
            disabled={formDisabled}
            onChange={(e) => setDescription(e.target.value.slice(0, 1500))}
            maxLength={1500}
          />
          <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
            {pl.communityCharCount(description.length, 1500)}
          </p>
        </div>
        <div>
          <div className="text-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.communityPublishTags}
          </div>
          <p className="mt-1 text-xs text-[var(--sr-text-muted)]">{pl.communityPublishTagsHint}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COMMUNITY_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                disabled={formDisabled}
                className={cn(
                  FOCUS_RING,
                  'rounded-[var(--sr-radius-full)] px-2.5 py-1.5 text-xs font-medium',
                  tags.includes(t)
                    ? 'bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]'
                    : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
                )}
                onClick={() => toggleTag(t)}
              >
                {communityTagLabel(t)}
              </button>
            ))}
          </div>
        </div>
        <Button
          type="button"
          size="touch"
          fullWidth
          disabled={formDisabled}
          onClick={() => void submit()}
        >
          {isUpdate ? pl.communityPublishUpdate : pl.communityPublishSubmit}
        </Button>
          </>
        )}
      </div>
    </Sheet>
  )
}
