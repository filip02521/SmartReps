import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { dateFnsLocale } from '@/lib/date-locale'
import { ChevronDown, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { NestedStat } from '@/components/ui/NestedStat'
import { pl } from '@/i18n/pl'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import {
  getSyncStatusSnapshot,
  type SyncAccountState,
  type SyncStatusSnapshot,
} from '@/lib/sync-status'
import { retryDeadLetterItems, clearDeadLetterItems } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'

const stateBadge: Record<
  SyncAccountState,
  { label: string; variant: 'success' | 'warning' | 'error' | 'info' }
> = {
  local_only: { label: pl.syncStatusLocalOnly, variant: 'info' },
  logged_in: { label: pl.syncStatusLoggedIn, variant: 'success' },
  logged_out_locally: { label: pl.syncStatusLoggedOutLocally, variant: 'info' },
  session_expired: { label: pl.syncStatusSessionExpired, variant: 'warning' },
  syncing: { label: pl.syncStatusSyncing, variant: 'info' },
  sync_error: { label: pl.syncStatusSyncError, variant: 'error' },
}

function formatLastSync(lastSyncedAt: string | null, online: boolean): string {
  if (!online) return pl.syncNowOffline
  if (lastSyncedAt) {
    return pl.syncLastAt(
      format(new Date(lastSyncedAt), 'd MMM yyyy, HH:mm', { locale: dateFnsLocale() }),
    )
  }
  return pl.syncNever
}

type AccountHeroProps = {
  syncing: boolean
  online: boolean
  showLogout: boolean
  onSyncNow: () => void | Promise<void>
  onLogin: () => void
  onLogout: () => void
}

/** Account + sync status for Profile — one primary CTA; logout is secondary ghost. */
export function AccountHero({
  syncing,
  online,
  showLogout,
  onSyncNow,
  onLogin,
  onLogout,
}: AccountHeroProps) {
  const hasCompletedFirstWorkout = useAppStore((s) => s.hasCompletedFirstWorkout)
  const [snapshot, setSnapshot] = useState<SyncStatusSnapshot | null>(null)
  const [retrying, setRetrying] = useState(false)

  const refresh = useCallback(async () => {
    const next = await getSyncStatusSnapshot({ syncing, online })
    setSnapshot(next)
  }, [syncing, online])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!isSupabaseConfigured) {
    return (
      <div className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3.5">
        <NestedStat value={pl.accountLocalOnly} hint={pl.syncFaqLocal} />
      </div>
    )
  }

  if (!snapshot) {
    return (
      <div
        className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3.5"
        aria-busy
        aria-label={pl.loading}
      >
        <div className="flex flex-col gap-2">
          <div className="h-5 w-24 rounded-full sr-skeleton-shimmer" />
          <div className="h-4 w-40 rounded-full sr-skeleton-shimmer" />
          <div className="h-4 w-32 rounded-full sr-skeleton-shimmer" />
        </div>
      </div>
    )
  }

  const badge = stateBadge[snapshot.accountState]
  const lastSyncLine = formatLastSync(snapshot.lastSyncedAt, snapshot.online)
  const detailLines = [
    snapshot.email ? pl.accountLoggedIn(snapshot.email) : null,
    lastSyncLine,
    snapshot.queuePendingCount > 0 && snapshot.online
      ? pl.syncQueuePending(snapshot.queuePendingCount)
      : null,
    snapshot.lastSyncFailureReason && snapshot.accountState === 'sync_error'
      ? pl.syncErrorReason(snapshot.lastSyncFailureReason)
      : null,
  ].filter(Boolean) as string[]

  const showLoginCta = snapshot.accountState === 'local_only'
  const showLoginAgain =
    snapshot.accountState === 'logged_out_locally' ||
    snapshot.accountState === 'session_expired'
  const showSyncCta =
    snapshot.accountState === 'sync_error' ||
    snapshot.accountState === 'logged_in' ||
    snapshot.accountState === 'syncing'

  const handleRetryDeadLetter = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      const { ok } = await retryDeadLetterItems()
      showToast(ok ? pl.toastSyncDone : pl.toastSyncFailed, ok ? 'success' : 'error')
      await refresh()
    } finally {
      setRetrying(false)
    }
  }

  const handleClearDeadLetter = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      const cleared = await clearDeadLetterItems()
      if (cleared > 0) {
        showToast(pl.toastSyncDone, 'success')
      } else {
        showToast(pl.toastSyncFailed, 'info')
      }
      await refresh()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        {detailLines.map((line, i) => (
          <p key={i} className="text-pretty text-sm leading-snug text-[var(--sr-text-secondary)]">
            {line}
          </p>
        ))}
        {detailLines.length === 0 && (
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.notLoggedIn}</p>
        )}
      </div>

      {snapshot.deadLetterCount > 0 && (
        <div className="flex items-start gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/40 bg-[var(--sr-warning)]/10 p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--sr-warning)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--sr-warning)]">
              {pl.syncDeadLetter(snapshot.deadLetterCount)}
            </p>
            <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
              {pl.syncClearDeadConfirm}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={retrying || syncing}
                onClick={() => void handleRetryDeadLetter()}
              >
                {retrying && <BrandLoader size={18} className="mr-2" />}
                {retrying ? pl.syncInProgress : pl.syncRetryDead}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                disabled={retrying || syncing}
                onClick={() => void handleClearDeadLetter()}
              >
                {pl.syncClearDead}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ — styled collapsible (not native <details>) */}
      <FaqCollapsible />

      <div className="flex flex-col gap-2.5 border-t border-[var(--sr-border-subtle)] pt-3">
        {showLoginCta && (
          <Button size="touch" fullWidth onClick={onLogin}>
            {hasCompletedFirstWorkout ? pl.syncCtaLoginBackup : pl.login}
          </Button>
        )}
        {showLoginAgain && (
          <Button size="touch" fullWidth onClick={onLogin}>
            {snapshot.accountState === 'session_expired'
              ? pl.syncCtaSessionExpired
              : pl.syncCtaLoginAgain}
          </Button>
        )}
        {showSyncCta && (
          <Button
            size="touch"
            fullWidth
            disabled={!online || syncing}
            onClick={() => void onSyncNow()}
          >
            {syncing && <BrandLoader size={18} className="mr-2" />}
            {syncing ? pl.syncInProgress : pl.syncNow}
          </Button>
        )}
        {showLogout && (
          <Button variant="ghost" size="md" fullWidth onClick={onLogout}>
            {pl.logout}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Styled FAQ collapsible — replaces native <details> for consistent focus + animation. */
function FaqCollapsible() {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left text-sm font-medium text-[var(--sr-text-primary)] transition-colors hover:bg-[var(--sr-bg-elevated)]"
      >
        {pl.syncFaqTitle}
        <ChevronDown
          size={18}
          className={cn(
            'shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200',
            open && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-in-out',
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <ul className="flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] px-3 py-3 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
            <li>{pl.syncFaqLocal}</li>
            <li>{pl.syncFaqLogin}</li>
            <li>{pl.syncFaqWhat}</li>
            <li>{pl.syncFaqMidWorkout}</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
