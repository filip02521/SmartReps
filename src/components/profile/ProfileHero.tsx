import { Settings, RefreshCw, LogIn, Pencil, Users, UserCheck, Globe, Lock, ChevronRight, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { UserPlanBadge } from '@/components/pro/UserPlanBadge'
import { ProfileTitleChip } from '@/components/achievements/ProfileTitleChip'
import { getProfileTitle } from '@/lib/achievements/titles'
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
  profileTitleId,
  onEditTitle,
  /** Ghost "Ustaw tytuł" CTA — hidden when picking is pointless (no unlocked
   *  titles and not Pro), so the hero stays quiet for those users. */
  canPickTitle,
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
  /** Selected achievement-title id — rendered as a tappable chip under the
   *  name so the pick has an immediate visual echo on the user's own profile. */
  profileTitleId: string | null
  onEditTitle: () => void
  canPickTitle: boolean
}) {
  // Avatar initials from display name or email
  const initials = (displayName || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?'

  const title = displayName || email || pl.navProfile
  const profileTitle = profileTitleId ? getProfileTitle(profileTitleId) : null
  const isPublic = followProfile?.is_public ?? false
  const bio = followProfile?.bio?.trim() ?? ''
  const showFollowStats = connected && online && !followLoading
  // Show skeleton pills during initial loading to avoid layout shift
  const showFollowPills = connected && online

  return (
    <div
      className="relative overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] px-4 pb-4 pt-6"
      style={{
        backgroundImage: `linear-gradient(
          135deg,
          color-mix(in srgb, var(--sr-brand-primary) 12%, var(--sr-bg-elevated)) 0%,
          color-mix(in srgb, var(--sr-brand-secondary) 6%, var(--sr-bg-elevated)) 50%,
          var(--sr-bg-elevated) 100%
        )`,
      }}
    >
      {/* Settings — gear floats in the card corner so the identity block
          can stay centered. px-10 on the stack below keeps long names
          clear of the 48px hit target. */}
      <button
        type="button"
        onClick={onOpenSettings}
        className={cn(
          FOCUS_RING,
          'absolute right-2 top-2 flex min-h-12 min-w-12 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
        )}
        aria-label={pl.profileHeroSettings}
      >
        <Settings size={20} />
      </button>

      {/* Identity — centered stack: avatar → name+plan → title chip →
          email → status line. Reads as a profile, not a settings row. */}
      <div className="flex flex-col items-center px-8 text-center">
        {/* Avatar — gradient circle with initials */}
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-[var(--sr-avatar-text)]"
          style={{
            background: 'var(--sr-brand-gradient)',
            boxShadow: 'var(--sr-shadow-glow)',
          }}
          aria-hidden
        >
          {initials}
        </div>

        <div className="mt-2.5 flex max-w-full items-center justify-center gap-2">
          <h1 className="min-w-0 break-words text-lg font-bold leading-tight text-[var(--sr-text-primary)]">
            {title}
          </h1>
          <UserPlanBadge />
        </div>
        {/* Title chip — the same public-facing label followers see; tap
            opens the picker. Ghost CTA when nothing is selected yet. */}
        {profileTitle ? (
          <button
            type="button"
            onClick={onEditTitle}
            aria-label={pl.profileTitleChangeAria(profileTitle)}
            className={cn(
              FOCUS_RING,
              'group/title mt-1.5 inline-flex items-center gap-1 rounded-[var(--sr-radius-sm)] px-1 py-0.5 transition-colors hover:bg-[var(--sr-bg-surface)]',
            )}
          >
            <ProfileTitleChip achievementId={profileTitleId} />
            <Pencil
              size={10}
              aria-hidden
              className="shrink-0 text-[var(--sr-text-muted)] opacity-60 transition-opacity group-hover/title:opacity-100 group-focus-visible/title:opacity-100"
            />
          </button>
        ) : canPickTitle ? (
          <button
            type="button"
            onClick={onEditTitle}
            className={cn(
              FOCUS_RING,
              'mt-2 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-dashed border-[var(--sr-border-subtle)] px-2.5 py-0.5 sr-text-caption font-medium text-[var(--sr-text-muted)] transition-colors hover:border-[var(--sr-brand-primary)] hover:text-[var(--sr-brand-primary)]',
            )}
          >
            <Crown size={11} aria-hidden className="shrink-0" />
            {pl.profileTitleSetCta}
          </button>
        ) : null}
        {email && displayName && (
          <p className="mt-1 break-words text-sm text-[var(--sr-text-secondary)]">
            {email}
          </p>
        )}
        {/* Status line — one muted caption instead of stacked pill badges.
            Priority: offline > local mode > public/private profile. The
            connected state needs no marker — email + sync CTA show it. */}
        {(!online || !connected || showFollowStats) && (
          <p className="mt-1.5 flex items-center justify-center gap-1.5 sr-text-caption text-[var(--sr-text-muted)]">
            {!online ? (
              pl.offline
            ) : !connected ? (
              pl.profileHeroLocal
            ) : showFollowStats ? (
              <>
                {isPublic ? <Globe size={11} aria-hidden /> : <Lock size={11} aria-hidden />}
                {isPublic ? pl.profileHeroPublic : pl.profileHeroPrivate}
              </>
            ) : null}
          </p>
        )}
      </div>

      {/* Bio — centered, constrained measure so long bios stay readable */}
      {showFollowStats && bio && (
        <p className="mx-auto mt-3 max-w-[34ch] text-pretty text-center text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          {bio}
        </p>
      )}

      {/* Follow stats — a segmented strip in the ProfileStats language:
          one bordered box, two centered cells split by a hairline. Each
          cell opens the followers/following sheet. */}
      {showFollowPills && (
        <div className="mt-3 grid grid-cols-2 divide-x divide-[var(--sr-border-subtle)] overflow-hidden rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]">
          {followLoading ? (
            <div className="col-span-2 h-11 sr-skeleton-shimmer" aria-hidden />
          ) : (
            <>
              <button
                type="button"
                onClick={onViewFollowers}
                aria-label={pl.profileHeroFollowersAria(followCounts.followers)}
                className={cn(
                  FOCUS_RING,
                  'group flex min-h-11 items-center justify-center gap-1.5 px-2 sr-text-body-sm text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] hover:text-[var(--sr-brand-primary)]',
                )}
              >
                <Users size={13} aria-hidden className="shrink-0 text-[var(--sr-text-muted)]" />
                <span className="tabular-nums font-semibold text-[var(--sr-text-primary)]">
                  {followCounts.followers}
                </span>
                <span className="truncate">{pl.profileHeroFollowers}</span>
                <ChevronRight
                  size={13}
                  className="shrink-0 text-[var(--sr-text-muted)] transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
              <button
                type="button"
                onClick={onViewFollowing}
                aria-label={pl.profileHeroFollowingAria(followCounts.following)}
                className={cn(
                  FOCUS_RING,
                  'group flex min-h-11 items-center justify-center gap-1.5 px-2 sr-text-body-sm text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] hover:text-[var(--sr-brand-primary)]',
                )}
              >
                <UserCheck size={13} aria-hidden className="shrink-0 text-[var(--sr-text-muted)]" />
                <span className="tabular-nums font-semibold text-[var(--sr-text-primary)]">
                  {followCounts.following}
                </span>
                <span className="truncate">{pl.profileHeroFollowing}</span>
                <ChevronRight
                  size={13}
                  className="shrink-0 text-[var(--sr-text-muted)] transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            </>
          )}
        </div>
      )}

      {/* Private profile hint — centered under the strip */}
      {showFollowStats && !isPublic && (
        <p className="mt-2 text-center sr-text-caption text-[var(--sr-text-muted)]">
          {pl.profileHeroFollowHint}
        </p>
      )}

      {/* CTAs — edit profile + sync/login, side by side on all widths
          (short labels fit a split row on 375px). */}
      <div className="mt-3.5 flex gap-2.5">
        {/* Edit profile — only when connected + online */}
        {connected && online && (
          <Button
            variant="secondary"
            size="md"
            className="min-w-0 flex-1 gap-2"
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
            className="min-w-0 flex-1 gap-2"
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
            className="min-w-0 flex-1 gap-2"
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
