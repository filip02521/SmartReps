import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { NestedStat } from '@/components/ui/NestedStat'
import { pl } from '@/i18n/pl'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import {
  getSyncStatusSnapshot,
  type SyncAccountState,
  type SyncStatusSnapshot,
} from '@/lib/sync-status'
import { retryDeadLetterItems } from '@/lib/sync'
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
      format(new Date(lastSyncedAt), 'd MMM yyyy, HH:mm', { locale: plLocale }),
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
      <div className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3.5">
        <NestedStat value={pl.loading} />
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

  return (
    <div className="flex flex-col gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>

      <div className="flex flex-col gap-1.5">
        {detailLines.map((line) => (
          <p key={line} className="text-pretty text-sm leading-snug text-[var(--sr-text-secondary)]">
            {line}
          </p>
        ))}
        {detailLines.length === 0 && (
          <p className="text-sm text-[var(--sr-text-secondary)]">{pl.notLoggedIn}</p>
        )}
      </div>

      {snapshot.deadLetterCount > 0 && (
        <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/40 bg-[var(--sr-warning)]/10 p-3">
          <p className="text-sm text-[var(--sr-warning)]">
            {pl.syncDeadLetter(snapshot.deadLetterCount)}
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3 justify-start px-4"
            fullWidth
            disabled={retrying || syncing}
            onClick={() => void handleRetryDeadLetter()}
          >
            {retrying ? pl.syncInProgress : pl.syncRetryDead}
          </Button>
        </div>
      )}

      <details className="group rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]/60">
        <summary
          className={cn(
            'flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-sm font-medium text-[var(--sr-text-primary)]',
            '[&::-webkit-details-marker]:hidden',
          )}
        >
          {pl.syncFaqTitle}
          <ChevronDown
            size={18}
            className="shrink-0 text-[var(--sr-text-muted)] transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <ul className="flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] px-3 py-3 text-sm leading-relaxed text-[var(--sr-text-secondary)]">
          <li>{pl.syncFaqLocal}</li>
          <li>{pl.syncFaqLogin}</li>
          <li>{pl.syncFaqWhat}</li>
          <li>{pl.syncFaqMidWorkout}</li>
        </ul>
      </details>

      <div className="flex flex-col gap-2.5 pt-1">
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
            {syncing ? pl.syncInProgress : pl.syncNow}
          </Button>
        )}
        {showLogout && (
          <Button variant="ghost" size="md" fullWidth className="justify-start px-4" onClick={onLogout}>
            {pl.logout}
          </Button>
        )}
      </div>
    </div>
  )
}
