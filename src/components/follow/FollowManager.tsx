import { useCallback, useEffect, useRef, useState } from 'react'
import { UserPlus, UserCheck, UserX, Loader2, Dumbbell, Flame, Trophy, Heart } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { EmptyState, FeedbackBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { showToast } from '@/stores/toast-store'
import { useAppStore } from '@/stores/app-store'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { useOnline } from '@/hooks/useOnline'
import {
  toggleFollow,
  upsertMyPublicProfile,
  type FolloweeProfile,
  type FollowerProfile,
  type PublicProfile,
} from '@/lib/follow-system'
import { refreshCommunityAuthorDisplayName } from '@/lib/community-api'
import type { FollowData } from '@/hooks/useFollowData'

/* ─── Follow button — used on community plan authors ─── */

export function FollowButton({
  targetUserId,
  initiallyFollowing,
  onToggled,
}: {
  targetUserId: string
  initiallyFollowing: boolean
  onToggled?: (following: boolean) => void
}) {
  const online = useOnline()
  const [following, setFollowing] = useState(initiallyFollowing)
  const [busy, setBusy] = useState(false)
  const [confirmUnfollow, setConfirmUnfollow] = useState(false)
  const isFirstRender = useRef(true)

  // Sync from props only on mount; after that keep local optimistic state
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setFollowing(initiallyFollowing)
  }, [initiallyFollowing])

  const handleFollow = useCallback(async () => {
    setBusy(true)
    try {
      const result = await toggleFollow(targetUserId)
      setFollowing(result.following)
      onToggled?.(result.following)
      showToast(pl.followDone, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'not_authenticated') showToast(pl.followLoginRequired, 'info')
      else if (msg === 'cannot_follow_self') showToast(pl.followCannotFollowSelf, 'info')
      else if (msg === 'user_not_public') showToast(pl.followUserNotPublic, 'info')
      else showToast(pl.followErrorGeneric, 'error')
    } finally {
      setBusy(false)
    }
  }, [targetUserId, onToggled])

  const handleUnfollow = useCallback(async () => {
    setConfirmUnfollow(false)
    setBusy(true)
    try {
      const result = await toggleFollow(targetUserId)
      setFollowing(result.following)
      onToggled?.(result.following)
      showToast(pl.unfollowDone, 'success')
    } catch {
      showToast(pl.followErrorGeneric, 'error')
    } finally {
      setBusy(false)
    }
  }, [targetUserId, onToggled])

  return (
    <>
      <Button
        size="sm"
        variant={following ? 'secondary' : 'primary'}
        onClick={following ? () => setConfirmUnfollow(true) : handleFollow}
        disabled={busy || !online}
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" aria-hidden />
        ) : following ? (
          <UserCheck size={16} aria-hidden />
        ) : (
          <UserPlus size={16} aria-hidden />
        )}
        {following ? pl.followingButton : pl.followButton}
      </Button>
      {confirmUnfollow && (
        <ConfirmSheet
          title={pl.unfollowConfirm}
          message={pl.unfollowConfirmMessage}
          confirmLabel={pl.unfollowButton}
          variant="danger"
          onConfirm={handleUnfollow}
          onCancel={() => setConfirmUnfollow(false)}
        />
      )}
    </>
  )
}

/* ─── Following list — users I follow with their stats ─── */

function FolloweeCard({
  profile,
  onUnfollow,
}: {
  profile: FolloweeProfile
  onUnfollow: (followeeId: string) => void
}) {
  const [confirmUnfollow, setConfirmUnfollow] = useState(false)
  const initial = (profile.display_name || '?').charAt(0).toUpperCase()

  return (
    <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
      <div className="flex items-center gap-3">
        {/* Avatar with initial */}
        <div aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)] font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {profile.display_name || pl.followAnonymous}
          </p>
          {profile.bio && (
            <p className="truncate sr-text-caption text-[var(--sr-text-muted)]">
              {profile.bio}
            </p>
          )}
        </div>
        {/* Unfollow button */}
        <button
          type="button"
          className={cn(
            FOCUS_RING,
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] text-[var(--sr-text-muted)] hover:text-[var(--sr-error)] hover:bg-[var(--sr-bg-surface)] transition-colors',
          )}
          onClick={() => setConfirmUnfollow(true)}
          aria-label={pl.followUnfollowFromList}
        >
          <UserX size={16} aria-hidden />
        </button>
      </div>
      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatChip
          icon={<Dumbbell size={12} aria-hidden />}
          label={pl.followStatsTotalSessions}
          value={profile.total_sessions}
        />
        <StatChip
          icon={<Flame size={12} aria-hidden />}
          label={pl.followStatsCurrentStreak}
          value={profile.current_streak_weeks}
        />
        <StatChip
          icon={<Trophy size={12} aria-hidden />}
          label={pl.followStatsPushupMax}
          value={profile.pushup_max}
        />
      </div>
      {confirmUnfollow && (
        <ConfirmSheet
          title={pl.unfollowConfirm}
          message={pl.unfollowConfirmMessage}
          confirmLabel={pl.unfollowButton}
          variant="danger"
          onConfirm={() => {
            setConfirmUnfollow(false)
            onUnfollow(profile.followee_id)
          }}
          onCancel={() => setConfirmUnfollow(false)}
        />
      )}
    </div>
  )
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)] px-2 py-1.5">
      <span className="flex items-center gap-1 sr-text-caption text-[var(--sr-text-muted)]">
        {icon}
        {label}
      </span>
      <span className="tabular-nums font-semibold text-[var(--sr-text-primary)]">
        {value}
      </span>
    </div>
  )
}

/* ─── Public profile editor sheet ─── */

export function PublicProfileSheet({
  open,
  onClose,
  existing,
  displayName,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  existing: PublicProfile | null
  displayName: string
  onSaved: () => void
}) {
  const setSettings = useAppStore((s) => s.setSettings)
  const [nameDraft, setNameDraft] = useState(displayName)
  const [bio, setBio] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (open) {
      setNameDraft(displayName)
      setBio(existing?.bio ?? '')
      setIsPublic(existing?.is_public ?? false)
      setError('')
    }
  }, [open, existing, displayName])

  const handleSave = useCallback(async () => {
    const trimmedName = nameDraft.trim()
    if (isPublic && !trimmedName) {
      setError(pl.followDisplayNameRequired)
      return
    }
    setBusy(true)
    setError('')
    const prevName = displayName
    try {
      // 1. Update public profile (display_name + bio + is_public) first
      await upsertMyPublicProfile({
        displayName: trimmedName,
        bio,
        isPublic,
      })
      if (!mountedRef.current) return
      // 2. Update local settings only after successful upsert
      if (trimmedName !== prevName) {
        setSettings({ displayName: trimmedName })
      }
      // 3. Sync display name to community publications if changed
      if (trimmedName !== prevName) {
        try {
          await refreshCommunityAuthorDisplayName(trimmedName)
        } catch {
          // non-critical — publish RPC also updates display_name
        }
        // 4. Push to cloud profiles table for cross-device sync
        try {
          const { pushProfileSettingsOnly } = await import('@/lib/sync')
          await pushProfileSettingsOnly()
        } catch {
          // non-critical — will sync on next regular sync cycle
        }
      }
      if (!mountedRef.current) return
      showToast(pl.followProfileSaved, 'success')
      onSaved()
      onClose()
    } catch (e) {
      if (!mountedRef.current) return
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'display_name_too_long') setError(pl.followDisplayName)
      else if (msg === 'bio_too_long') setError(pl.followBioHint)
      else if (msg === 'not_authenticated') setError(pl.followLoginRequired)
      else setError(pl.followErrorGeneric)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [nameDraft, bio, isPublic, displayName, setSettings, onSaved, onClose])

  return (
    <Sheet open={open} onClose={onClose} title={pl.followPublicProfile}>
      <div className="flex flex-col gap-4">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.followPublicProfileHint}
        </p>

        {error && <FeedbackBanner variant="error" message={error} />}

        {/* Display name — editable, synced to settings + community */}
        <div className="flex flex-col gap-2">
          <label htmlFor="follow-display-name" className="sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.followDisplayName}
          </label>
          <input
            id="follow-display-name"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value.slice(0, 40))}
            placeholder={pl.communityDisplayNameHint}
            maxLength={40}
            aria-describedby="follow-display-name-hint"
            className={cn(
              FOCUS_RING,
              'w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5 sr-text-body-sm text-[var(--sr-text-primary)] placeholder:text-[var(--sr-text-muted)]',
            )}
          />
          <span id="follow-display-name-hint" className="sr-text-caption text-[var(--sr-text-muted)]">
            {pl.communityDisplayNameHint}
          </span>
        </div>

        {/* Bio */}
        <div className="flex flex-col gap-2">
          <label htmlFor="follow-bio" className="sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.followBio}
          </label>
          <textarea
            id="follow-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 200))}
            placeholder={pl.followBioPlaceholder}
            rows={3}
            aria-describedby="follow-bio-counter"
            className={cn(
              FOCUS_RING,
              'w-full resize-none rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 sr-text-body-sm text-[var(--sr-text-primary)] placeholder:text-[var(--sr-text-muted)]',
            )}
            maxLength={200}
          />
          <span id="follow-bio-counter" className="text-right sr-text-caption text-[var(--sr-text-muted)]">
            {bio.length}/200
          </span>
        </div>

        {/* Public toggle */}
        <button
          type="button"
          onClick={() => setIsPublic(!isPublic)}
          className={cn(
            FOCUS_RING,
            'flex items-center justify-between rounded-[var(--sr-radius-md)] border px-3 py-3 text-left transition-colors',
            isPublic
              ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]'
              : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
          )}
          role="switch"
          aria-checked={isPublic}
        >
          <span className="flex flex-col">
            <span className="sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
              {isPublic ? pl.followMakePrivate : pl.followMakePublic}
            </span>
            <span className="sr-text-caption text-[var(--sr-text-muted)]">
              {pl.followPublicProfileHint}
            </span>
          </span>
          <span
            className={cn(
              'flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
              isPublic ? 'bg-[var(--sr-brand-primary)]' : 'bg-[var(--sr-border-strong)]',
            )}
            aria-hidden
          >
            <span
              className={cn(
                'h-5 w-5 rounded-full bg-[var(--sr-bg-base)] shadow-sm transition-transform',
                isPublic ? 'translate-x-5' : 'translate-x-0.5',
              )}
            />
          </span>
        </button>

        <Button fullWidth disabled={busy} onClick={handleSave}>
          {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
          {pl.followSaveProfile}
        </Button>
      </div>
    </Sheet>
  )
}

/* ─── Following list section — used in Profile below hero ─── */

export function FollowingListSection({ followData }: { followData: FollowData }) {
  const online = useOnline()
  const [unfollowBusy, setUnfollowBusy] = useState<string | null>(null)

  const handleUnfollow = useCallback(async (followeeId: string) => {
    setUnfollowBusy(followeeId)
    try {
      await followData.unfollow(followeeId)
    } finally {
      setUnfollowBusy(null)
    }
  }, [followData])

  if (!isSupabaseConfigured || !online) return null
  if (followData.loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={20} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
        {pl.followFollowingList}
      </h3>
      {followData.following.length === 0 ? (
        <EmptyState
          title={pl.followEmpty}
          description={pl.followEmptyHint}
        />
      ) : (
        <div className="space-y-2">
          {followData.following.map((f) => (
            <div
              key={f.followee_id}
              className={cn(
                unfollowBusy === f.followee_id && 'opacity-50 pointer-events-none',
              )}
            >
              <FolloweeCard
                profile={f}
                onUnfollow={handleUnfollow}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── Follower card — someone who follows me ─── */

function FollowerCard({ profile }: { profile: FollowerProfile }) {
  const initial = (profile.display_name || '?').charAt(0).toUpperCase()

  return (
    <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
      <div className="flex items-center gap-3">
        {/* Avatar with initial */}
        <div
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--sr-brand-primary-muted)] font-semibold text-[var(--sr-brand-primary)]"
        >
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {profile.display_name || pl.followAnonymous}
          </p>
          {profile.bio && (
            <p className="truncate sr-text-caption text-[var(--sr-text-muted)]">
              {profile.bio}
            </p>
          )}
        </div>
        {/* Heart icon — indicates they follow you */}
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] text-[var(--sr-brand-primary)]"
          aria-hidden
        >
          <Heart size={16} />
        </span>
      </div>
      {/* Stats row */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatChip
          icon={<Dumbbell size={12} aria-hidden />}
          label={pl.followStatsTotalSessions}
          value={profile.total_sessions}
        />
        <StatChip
          icon={<Flame size={12} aria-hidden />}
          label={pl.followStatsCurrentStreak}
          value={profile.current_streak_weeks}
        />
        <StatChip
          icon={<Trophy size={12} aria-hidden />}
          label={pl.followStatsPushupMax}
          value={profile.pushup_max}
        />
      </div>
    </div>
  )
}

/* ─── Followers sheet — modal showing who follows me ─── */

export function FollowersSheet({
  open,
  onClose,
  followers,
  loading,
}: {
  open: boolean
  onClose: () => void
  followers: FollowerProfile[]
  loading: boolean
}) {
  return (
    <Sheet open={open} onClose={onClose} title={pl.followFollowersSheetTitle}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
        </div>
      ) : followers.length === 0 ? (
        <EmptyState
          title={pl.followFollowersEmpty}
          description={pl.followFollowersEmptyHint}
        />
      ) : (
        <div className="space-y-2">
          {followers.map((f) => (
            <FollowerCard key={f.follower_id} profile={f} />
          ))}
        </div>
      )}
    </Sheet>
  )
}

/* ─── Following sheet — modal showing who I follow ─── */

export function FollowingSheet({
  open,
  onClose,
  followData,
}: {
  open: boolean
  onClose: () => void
  followData: FollowData
}) {
  const online = useOnline()
  const [unfollowBusy, setUnfollowBusy] = useState<string | null>(null)

  const handleUnfollow = useCallback(async (followeeId: string) => {
    setUnfollowBusy(followeeId)
    try {
      await followData.unfollow(followeeId)
    } finally {
      setUnfollowBusy(null)
    }
  }, [followData])

  if (!isSupabaseConfigured || !online) return null

  return (
    <Sheet open={open} onClose={onClose} title={pl.followFollowingSheetTitle}>
      {followData.loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
        </div>
      ) : followData.following.length === 0 ? (
        <EmptyState
          title={pl.followEmpty}
          description={pl.followEmptyHint}
        />
      ) : (
        <div className="space-y-2">
          {followData.following.map((f) => (
            <div
              key={f.followee_id}
              className={cn(
                unfollowBusy === f.followee_id && 'opacity-50 pointer-events-none',
              )}
            >
              <FolloweeCard
                profile={f}
                onUnfollow={handleUnfollow}
              />
            </div>
          ))}
        </div>
      )}
    </Sheet>
  )
}
