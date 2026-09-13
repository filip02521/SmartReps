import { useEffect, useRef, useState } from 'react'
import { Dumbbell, Flame, Loader2, Zap } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar, FollowButton } from '@/components/follow/FollowManager'
import { ProfileTitleChip } from '@/components/achievements/ProfileTitleChip'
import { pl } from '@/i18n/pl'
import { getPublicProfile, type PublicProfile } from '@/lib/follow-system'

type ProfileState = 'loading' | 'loaded' | 'private' | 'error'

/**
 * Bottom sheet opened by tapping a row in a challenge leaderboard.
 * Shows the user's public profile summary (when available) plus a
 * follow/unfollow button. Toggling is reported back via onToggled so the
 * leaderboard can refresh its "following" markers and filter.
 */
export function ChallengeUserSheet({
  userId,
  displayName,
  isFollowing,
  onToggled,
  onClose,
}: {
  userId: string | null
  displayName: string
  isFollowing: boolean
  onToggled: (userId: string, following: boolean) => void
  onClose: () => void
}) {
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [state, setState] = useState<ProfileState>('loading')
  const requestIdRef = useRef(0)

  useEffect(() => {
    setProfile(null)
    if (!userId) return
    const reqId = ++requestIdRef.current
    setState('loading')
    getPublicProfile(userId)
      .then((p) => {
        if (reqId !== requestIdRef.current) return
        setProfile(p)
        setState(p ? 'loaded' : 'private')
      })
      .catch((e) => {
        if (reqId !== requestIdRef.current) return
        setState(
          e instanceof Error && e.message === 'profile_not_public'
            ? 'private'
            : 'error',
        )
      })
  }, [userId])

  // 'private' without an existing follow → nobody can follow them.
  // 'error' (e.g. anonymous session, network blip) → still show the button;
  // FollowButton handles not_authenticated / user_not_public itself.
  const showFollow =
    state === 'loaded' || state === 'error' || isFollowing

  return (
    <Sheet open={userId !== null} onClose={onClose} title={displayName}>
      <div className="flex items-start gap-3">
        <Avatar name={displayName} />
        <div className="min-w-0 flex-1">
          <p className="break-words sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
            {displayName}
          </p>
          <ProfileTitleChip
            achievementId={profile?.title_achievement_id}
            className="mt-0.5"
          />
          {profile?.bio ? (
            <p className="mt-1 break-words sr-text-caption text-[var(--sr-text-muted)]">
              {profile.bio}
            </p>
          ) : null}
        </div>
      </div>

      {state === 'loading' && (
        <div
          className="mt-4 flex items-center justify-center py-2"
          aria-busy
          aria-label={pl.loading}
        >
          <Loader2
            size={18}
            className="animate-spin text-[var(--sr-text-muted)]"
            aria-hidden
          />
        </div>
      )}

      {profile && (
        <div className="mt-3 flex items-center gap-3 sr-text-caption text-[var(--sr-text-muted)]">
          <span className="flex items-center gap-1 tabular-nums">
            <Dumbbell
              size={11}
              aria-hidden
              className="text-[var(--sr-text-secondary)]"
            />
            {profile.total_sessions}
          </span>
          {profile.current_streak_weeks > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <Flame
                size={11}
                aria-hidden
                className="text-[var(--sr-warning)]"
              />
              {profile.current_streak_weeks}
              {pl.followStatsWeeksShort}
            </span>
          )}
          {profile.total_reps > 0 && (
            <span className="flex items-center gap-1 tabular-nums">
              <Zap
                size={11}
                aria-hidden
                className="text-[var(--sr-brand-secondary)]"
              />
              {profile.total_reps}
            </span>
          )}
          {profile.achievement_count > 0 && (
            <span className="tabular-nums">
              {pl.followStatsAchievementsCount(profile.achievement_count)}
            </span>
          )}
        </div>
      )}

      {state !== 'loading' && (
        <div className="mt-4">
          {showFollow && userId ? (
            <FollowButton
              targetUserId={userId}
              initiallyFollowing={isFollowing}
              onToggled={(following) => onToggled(userId, following)}
            />
          ) : (
            <p className="sr-text-body-sm text-[var(--sr-text-muted)]">
              {pl.followUserNotPublic}
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
