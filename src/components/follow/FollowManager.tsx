import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UserCheck, UserX, Loader2, Dumbbell, Flame, Trophy, Heart, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { EmptyState, FeedbackBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { showToast } from '@/stores/toast-store'
import { useAppStore } from '@/stores/app-store'
import { useOnline } from '@/hooks/useOnline'
import {
  toggleFollow,
  upsertMyPublicProfile,
  type FolloweeProfile,
  type FollowerProfile,
  type PublicProfile,
  type PublicAchievementBadge,
} from '@/lib/follow-system'
import { refreshCommunityAuthorDisplayName } from '@/lib/community-api'
import { ACHIEVEMENT_BY_ID, resolveDisplayGlyph, resolveDisplayRarity } from '@/lib/achievements/catalog'
import { achievementTitle } from '@/lib/achievements/copy'
import type { AchievementId, AchievementDef, LocalAchievementUnlock } from '@/lib/achievements/types'
import { GLYPHS } from '@/components/achievements/AchievementTile'
import { TrophyShape } from '@/components/achievements/TrophyShape'
import { AchievementDetailSheet } from '@/components/achievements/AchievementDetailSheet'
import { trophyShapeFor, trophyTierFor } from '@/lib/achievements/trophy-tier'
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
  const navigate = useNavigate()
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
      window.dispatchEvent(new Event('sr-follow-changed'))
      showToast(pl.followDone, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'not_authenticated') {
        showToast(pl.followLoginRequired, 'info')
        const returnTo = window.location.pathname + window.location.search
        navigate(`/setup/login?returnTo=${encodeURIComponent(returnTo)}`)
      }
      else if (msg === 'cannot_follow_self') showToast(pl.followCannotFollowSelf, 'info')
      else if (msg === 'user_not_public') showToast(pl.followUserNotPublic, 'info')
      else showToast(pl.followErrorGeneric, 'error')
    } finally {
      setBusy(false)
    }
  }, [targetUserId, onToggled, navigate])

  const handleUnfollow = useCallback(async () => {
    setConfirmUnfollow(false)
    setBusy(true)
    try {
      const result = await toggleFollow(targetUserId)
      setFollowing(result.following)
      onToggled?.(result.following)
      window.dispatchEvent(new Event('sr-follow-changed'))
      showToast(pl.unfollowDone, 'success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'not_authenticated') {
        showToast(pl.followLoginRequired, 'info')
        const returnTo = window.location.pathname + window.location.search
        navigate(`/setup/login?returnTo=${encodeURIComponent(returnTo)}`)
      } else {
        showToast(pl.followErrorGeneric, 'error')
      }
    } finally {
      setBusy(false)
    }
  }, [targetUserId, onToggled, navigate])

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

/* ─── Achievement trophy badge for follow cards ─── */

function AchievementTrophyBadge({ badge, onOpen }: {
  badge: PublicAchievementBadge
  onOpen: (def: AchievementDef, unlock: LocalAchievementUnlock) => void
}) {
  const def = ACHIEVEMENT_BY_ID[badge.achievement_id as AchievementId]
  if (!def) return null
  const glyphKey = resolveDisplayGlyph(def, badge.tier_level)
  const Icon = GLYPHS[glyphKey] ?? GLYPHS[def.glyph] ?? Trophy
  const tier = trophyTierFor(def, true, badge.tier_level)
  const shape = trophyShapeFor(def)
  const title = achievementTitle(badge.achievement_id as AchievementId)

  const handleClick = () => {
    onOpen(def, {
      id: def.id,
      unlockedAt: badge.unlocked_at ?? new Date().toISOString(),
      seenAt: null,
      tierLevel: badge.tier_level ?? null,
    })
  }

  // If the achievement has a trophy tier (gold/diamond/silver), render the full
  // metallic TrophyShape. Otherwise, render a simple icon badge.
  if (tier) {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn('shrink-0 transition-transform hover:scale-110 active:scale-95', FOCUS_RING)}
        title={title}
        aria-label={title}
      >
        <TrophyShape
          tier={tier}
          shape={shape}
          px={36}
          glyph={<Icon size={12} aria-hidden />}
          ariaHidden
        />
      </button>
    )
  }

  // Non-trophy achievements: simple icon badge with rarity-based color
  const rarity = resolveDisplayRarity(def, null, badge.tier_level)
  const rarityClass =
    rarity === 'legendary'
      ? 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)] ring-[var(--sr-brand-primary)]'
      : rarity === 'rare'
        ? 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)] ring-[var(--sr-border-strong)]'
        : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)] ring-[var(--sr-border-subtle)]'

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 transition-transform hover:scale-110 active:scale-95',
        rarityClass,
        FOCUS_RING,
      )}
      title={title}
      aria-label={title}
    >
      <Icon size={16} aria-hidden />
    </button>
  )
}

function BadgeRow({ badges, onOpen }: {
  badges: PublicAchievementBadge[]
  onOpen: (def: AchievementDef, unlock: LocalAchievementUnlock) => void
}) {
  if (!badges || badges.length === 0) {
    return null
  }
  return (
    <div className="flex items-center gap-2 overflow-visible">
      {badges.map((b, i) => (
        <AchievementTrophyBadge key={`${b.achievement_id}-${i}`} badge={b} onOpen={onOpen} />
      ))}
    </div>
  )
}

/* ─── Avatar with deterministic color from name ─── */

const AVATAR_COLORS = [
  'bg-indigo-500/20 text-indigo-300',
  'bg-cyan-500/20 text-cyan-300',
  'bg-emerald-500/20 text-emerald-300',
  'bg-amber-500/20 text-amber-300',
  'bg-rose-500/20 text-rose-300',
  'bg-violet-500/20 text-violet-300',
  'bg-teal-500/20 text-teal-300',
  'bg-orange-500/20 text-orange-300',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  const color = avatarColor(name || '?')
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-base'
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold',
        sizeClass,
        color,
      )}
    >
      {initial}
    </div>
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
  const [badgeDetail, setBadgeDetail] = useState<{
    def: AchievementDef
    unlock: LocalAchievementUnlock
  } | null>(null)
  const name = profile.display_name || pl.followAnonymous
  const hasBadges = profile.top_achievements && profile.top_achievements.length > 0

  return (
    <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 transition-colors hover:border-[var(--sr-border-strong)]">
      <div className="flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {name}
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
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)] text-[var(--sr-text-muted)] hover:text-[var(--sr-error)] hover:bg-[var(--sr-error-muted)] transition-colors',
          )}
          onClick={() => setConfirmUnfollow(true)}
          aria-label={pl.followUnfollowFromList}
        >
          <UserX size={16} aria-hidden />
        </button>
      </div>
      {/* Stats row — compact inline stats */}
      <div className="mt-2.5 flex items-center gap-3 sr-text-caption text-[var(--sr-text-muted)]">
        <span className="flex items-center gap-1 tabular-nums">
          <Dumbbell size={11} aria-hidden className="text-[var(--sr-text-secondary)]" />
          {profile.total_sessions}
        </span>
        {profile.current_streak_weeks > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <Flame size={11} aria-hidden className="text-[var(--sr-warning)]" />
            {profile.current_streak_weeks}{pl.followStatsWeeksShort}
          </span>
        )}
        {profile.total_reps > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <Zap size={11} aria-hidden className="text-[var(--sr-brand-secondary)]" />
            {profile.total_reps}
          </span>
        )}
      </div>
      {/* Achievement trophies row — only if user has badges */}
      {hasBadges && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--sr-border-subtle)] pt-2.5">
          <BadgeRow badges={profile.top_achievements} onOpen={(def, unlock) => setBadgeDetail({ def, unlock })} />
          {profile.achievement_count > 0 && (
            <span className="shrink-0 sr-text-caption text-[var(--sr-text-muted)] tabular-nums">
              {pl.followStatsAchievementsCount(profile.achievement_count)}
            </span>
          )}
        </div>
      )}
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
      <AchievementDetailSheet
        open={badgeDetail !== null}
        onClose={() => setBadgeDetail(null)}
        def={badgeDetail?.def ?? ACHIEVEMENT_BY_ID.first_session}
        unlock={badgeDetail?.unlock}
      />
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
        showcaseSlots: existing?.showcase_slots ?? null,
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
  }, [nameDraft, bio, isPublic, displayName, setSettings, onSaved, onClose, existing])

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

/* ─── Follower card — someone who follows me ─── */

function FollowerCard({ profile }: { profile: FollowerProfile }) {
  const [badgeDetail, setBadgeDetail] = useState<{
    def: AchievementDef
    unlock: LocalAchievementUnlock
  } | null>(null)
  const name = profile.display_name || pl.followAnonymous
  const hasBadges = profile.top_achievements && profile.top_achievements.length > 0

  return (
    <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 transition-colors hover:border-[var(--sr-border-strong)]">
      <div className="flex items-center gap-3">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {name}
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
          aria-label={pl.followFollowsYou}
        >
          <Heart size={16} aria-hidden fill="currentColor" />
        </span>
      </div>
      {/* Stats row — compact inline stats */}
      <div className="mt-2.5 flex items-center gap-3 sr-text-caption text-[var(--sr-text-muted)]">
        <span className="flex items-center gap-1 tabular-nums">
          <Dumbbell size={11} aria-hidden className="text-[var(--sr-text-secondary)]" />
          {profile.total_sessions}
        </span>
        {profile.current_streak_weeks > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <Flame size={11} aria-hidden className="text-[var(--sr-warning)]" />
            {profile.current_streak_weeks}{pl.followStatsWeeksShort}
          </span>
        )}
        {profile.total_reps > 0 && (
          <span className="flex items-center gap-1 tabular-nums">
            <Zap size={11} aria-hidden className="text-[var(--sr-brand-secondary)]" />
            {profile.total_reps}
          </span>
        )}
      </div>
      {/* Achievement trophies row — only if user has badges */}
      {hasBadges && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--sr-border-subtle)] pt-2.5">
          <BadgeRow badges={profile.top_achievements} onOpen={(def, unlock) => setBadgeDetail({ def, unlock })} />
          {profile.achievement_count > 0 && (
            <span className="shrink-0 sr-text-caption text-[var(--sr-text-muted)] tabular-nums">
              {pl.followStatsAchievementsCount(profile.achievement_count)}
            </span>
          )}
        </div>
      )}
      <AchievementDetailSheet
        open={badgeDetail !== null}
        onClose={() => setBadgeDetail(null)}
        def={badgeDetail?.def ?? ACHIEVEMENT_BY_ID.first_session}
        unlock={badgeDetail?.unlock}
      />
    </div>
  )
}

/* ─── Followers sheet — modal showing who follows me ─── */

export function FollowersSheet({
  open,
  onClose,
  followers,
  loading,
  error,
  onRetry,
}: {
  open: boolean
  onClose: () => void
  followers: FollowerProfile[]
  loading: boolean
  error?: boolean
  onRetry?: () => void
}) {
  return (
    <Sheet open={open} onClose={onClose} title={pl.followFollowersSheetTitle(followers.length)}>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
        </div>
      ) : error ? (
        <EmptyState
          icon={<Users size={48} />}
          title={pl.followLoadError}
          description={pl.followLoadErrorHint}
          action={onRetry ? { label: pl.followRetry, onClick: onRetry } : undefined}
        />
      ) : followers.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
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
  const [unfollowBusy, setUnfollowBusy] = useState<string | null>(null)

  const handleUnfollow = useCallback(async (followeeId: string) => {
    setUnfollowBusy(followeeId)
    try {
      await followData.unfollow(followeeId)
    } finally {
      setUnfollowBusy(null)
    }
  }, [followData])

  return (
    <Sheet open={open} onClose={onClose} title={pl.followFollowingSheetTitle(followData.following.length)}>
      {followData.loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
        </div>
      ) : followData.error ? (
        <EmptyState
          title={pl.followLoadError}
          description={pl.followLoadErrorHint}
          action={{ label: pl.followRetry, onClick: () => void followData.reload() }}
        />
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
