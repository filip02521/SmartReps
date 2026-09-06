import { Settings, RefreshCw, LogIn, Pencil, Users, UserCheck, Globe, Lock, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import type { PublicProfile, FollowCounts } from '@/lib/follow-system'

/**
 * Profile hero — brand gradient card with user identity, sync status, follow stats,
 * public/private badge, bio, and quick CTAs (sync/login + edit profile).
 */
export function ProfileHero({
  displayName,
  email,
  connected,
  syncing,
  online,
  onSyncNow,
  onLogin,
  onOpenSettings,
  // Follow system
  followProfile,
  followCounts,
  followLoading,
  onEditProfile,
  onViewFollowers,
  onViewFollowing,
}: {
  displayName: string
  email: string | null
  connected: boolean
  syncing: boolean
  online: boolean
  onSyncNow: () => void
  onLogin: () => void
  onOpenSettings: () => void
  followProfile: PublicProfile | null
  followCounts: FollowCounts
  followLoading: boolean
  onEditProfile: () => void
  onViewFollowers: () => void
  onViewFollowing: () => void
}) {
  // Avatar initials from display name or email
  const initials = (displayName || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?'

  const title = displayName || email || pl.navProfile
  const isPublic = followProfile?.is_public ?? false
  const bio = followProfile?.bio?.trim() ?? ''
  const showFollowStats = connected && online && !followLoading
  // Show skeleton pills during initial loading to avoid layout shift
  const showFollowPills = connected && online

  return (
    <div
      className="relative overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] p-4"
      style={{
        backgroundImage: `linear-gradient(
          135deg,
          color-mix(in srgb, var(--sr-brand-primary) 12%, var(--sr-bg-elevated)) 0%,
          color-mix(in srgb, var(--sr-brand-secondary) 6%, var(--sr-bg-elevated)) 50%,
          var(--sr-bg-elevated) 100%
        )`,
      }}
    >
      <div className="flex items-start gap-3.5">
        {/* Avatar — gradient circle with initials */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-[var(--sr-avatar-text)]"
          style={{
            background: 'var(--sr-brand-gradient)',
            boxShadow: 'var(--sr-shadow-glow)',
          }}
          aria-hidden
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight text-[var(--sr-text-primary)]">
            {title}
          </h1>
          {email && displayName && (
            <p className="mt-0.5 truncate text-sm text-[var(--sr-text-secondary)]">
              {email}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant={connected ? 'success' : 'info'}>
              {connected ? pl.profileHeroConnected : pl.profileHeroLocal}
            </Badge>
            {/* Public/private badge */}
            {showFollowStats && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                  isPublic
                    ? 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]'
                    : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
                )}
              >
                {isPublic ? <Globe size={11} aria-hidden /> : <Lock size={11} aria-hidden />}
                {isPublic ? pl.profileHeroPublic : pl.profileHeroPrivate}
              </span>
            )}
            {!online && (
              <span className="text-xs text-[var(--sr-text-muted)]">{pl.offline}</span>
            )}
          </div>
        </div>

        {/* Settings — gear icon */}
        <button
          type="button"
          onClick={onOpenSettings}
          className={cn(
            FOCUS_RING,
            'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
          )}
          aria-label={pl.profileHeroSettings}
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Bio — if set */}
      {showFollowStats && bio && (
        <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {bio}
        </p>
      )}

      {/* Follow stats — tappable pills opening followers/following sheets */}
      {showFollowPills && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {followLoading ? (
            <>
              {/* Skeleton pills during initial load — prevents layout shift */}
              <div className="h-[4.25rem] rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/60 px-3 py-2.5">
                <div className="h-3 w-20 rounded sr-skeleton-shimmer" />
                <div className="mt-2 h-5 w-8 rounded sr-skeleton-shimmer" />
              </div>
              <div className="h-[4.25rem] rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/60 px-3 py-2.5">
                <div className="h-3 w-20 rounded sr-skeleton-shimmer" />
                <div className="mt-2 h-5 w-8 rounded sr-skeleton-shimmer" />
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onViewFollowers}
                aria-label={pl.profileHeroFollowersAria(followCounts.followers)}
                className={cn(
                  FOCUS_RING,
                  'group flex flex-col items-start gap-0.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/60 px-3 py-2.5 text-left transition-colors hover:border-[var(--sr-brand-primary)] hover:bg-[var(--sr-brand-primary-muted)]',
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-1.5 sr-text-caption text-[var(--sr-text-muted)]">
                    <Users size={13} aria-hidden />
                    {pl.profileHeroFollowers}
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-[var(--sr-text-muted)] transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="tabular-nums text-xl font-bold leading-tight text-[var(--sr-text-primary)]">
                  {followCounts.followers}
                </span>
              </button>
              <button
                type="button"
                onClick={onViewFollowing}
                aria-label={pl.profileHeroFollowingAria(followCounts.following)}
                className={cn(
                  FOCUS_RING,
                  'group flex flex-col items-start gap-0.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]/60 px-3 py-2.5 text-left transition-colors hover:border-[var(--sr-brand-primary)] hover:bg-[var(--sr-brand-primary-muted)]',
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-1.5 sr-text-caption text-[var(--sr-text-muted)]">
                    <UserCheck size={13} aria-hidden />
                    {pl.profileHeroFollowing}
                  </span>
                  <ChevronRight
                    size={14}
                    className="text-[var(--sr-text-muted)] transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="tabular-nums text-xl font-bold leading-tight text-[var(--sr-text-primary)]">
                  {followCounts.following}
                </span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Private profile hint */}
      {showFollowStats && !isPublic && (
        <p className="mt-2 sr-text-caption text-[var(--sr-text-muted)]">
          {pl.profileHeroFollowHint}
        </p>
      )}

      {/* CTAs — edit profile + sync/login */}
      <div className="mt-3.5 flex gap-2.5">
        {/* Edit profile — only when connected + online */}
        {connected && online && (
          <Button
            variant="secondary"
            size="md"
            className="flex-1 gap-2"
            onClick={onEditProfile}
          >
            <Pencil size={16} aria-hidden />
            {pl.profileHeroEditProfile}
          </Button>
        )}

        {/* Sync or login */}
        {connected ? (
          <Button
            variant="secondary"
            size="md"
            className="flex-1 gap-2"
            disabled={!online || syncing}
            onClick={onSyncNow}
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} aria-hidden />
            {syncing ? pl.syncInProgress : pl.profileHeroSyncNow}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            className="flex-1 gap-2"
            onClick={onLogin}
          >
            <LogIn size={16} aria-hidden />
            {pl.profileHeroLogin}
          </Button>
        )}
      </div>
    </div>
  )
}
