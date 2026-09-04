import { Settings, RefreshCw, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

/**
 * Profile hero — brand gradient card with user identity, sync status, and quick CTA.
 * Replaces the plain PageHeader on the Profile page with a visual anchor.
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
}: {
  displayName: string
  email: string | null
  connected: boolean
  syncing: boolean
  online: boolean
  onSyncNow: () => void
  onLogin: () => void
  onOpenSettings: () => void
}) {
  // Avatar initials from display name or email
  const initials = (displayName || email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? '')
    .join('') || '?'

  const title = displayName || email || pl.navProfile

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
      <div className="flex items-center gap-3.5">
        {/* Avatar — gradient circle with initials */}
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
          style={{
            background: 'var(--sr-brand-gradient)',
            boxShadow: 'var(--sr-shadow-glow)',
          }}
          aria-hidden
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold leading-tight text-[var(--sr-text-primary)]">
            {title}
          </p>
          {email && displayName && (
            <p className="mt-0.5 truncate text-sm text-[var(--sr-text-secondary)]">
              {email}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2">
            <Badge variant={connected ? 'success' : 'info'}>
              {connected ? pl.profileHeroConnected : pl.profileHeroLocal}
            </Badge>
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
            'flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
          )}
          aria-label={pl.profileHeroSettings}
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Quick CTA — sync or login */}
      <div className="mt-3.5">
        {connected ? (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            disabled={!online || syncing}
            onClick={onSyncNow}
            className="gap-2"
          >
            <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} aria-hidden />
            {syncing ? pl.syncInProgress : pl.profileHeroSyncNow}
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={onLogin}
            className="gap-2"
          >
            <LogIn size={16} aria-hidden />
            {pl.profileHeroLogin}
          </Button>
        )}
      </div>
    </div>
  )
}
