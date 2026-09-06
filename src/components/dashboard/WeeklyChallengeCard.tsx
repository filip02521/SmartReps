import { useCallback, useEffect, useRef, useState } from 'react'
import { Trophy, Loader2, Send, Users, Clock, Medal, Target } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { EmptyState, FeedbackBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { showToast } from '@/stores/toast-store'
import { useAppStore } from '@/stores/app-store'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { useOnline } from '@/hooks/useOnline'
import {
  getActiveWeeklyChallenge,
  submitWeeklyChallengeEntry,
  getWeeklyChallengeLeaderboard,
  getMyWeeklyChallengeEntry,
  getWeeklyChallengeParticipantCount,
  type WeeklyChallenge,
  type LeaderboardEntry,
  type ChallengeEntry,
} from '@/lib/weekly-challenge'

function daysUntil(endDate: string): number {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  return Math.ceil((end - now) / 86400000)
}

function programLabel(program: 'pushups' | 'pullups'): string {
  return program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
}

/* ── Medal colors using CSS custom properties (no hardcoded hex) ── */
const MEDAL_CLASS: Record<number, string> = {
  1: 'text-[var(--sr-warning)]',
  2: 'text-[var(--sr-text-secondary)]',
  3: 'text-[var(--sr-bronze)]',
}

/* ─── Leaderboard list ─── */

function Leaderboard({
  entries,
  currentUserId,
}: {
  entries: LeaderboardEntry[]
  currentUserId: string | null
}) {
  if (entries.length === 0) {
    return <EmptyState title={pl.challengeLeaderboardEmpty} />
  }
  return (
    <ol className="space-y-1.5" aria-label={pl.challengeLeaderboard}>
      {entries.map((entry) => {
        const isMe = entry.user_id === currentUserId
        const medalClass = MEDAL_CLASS[entry.rank] ?? 'text-[var(--sr-text-muted)]'
        return (
          <li
            key={entry.id}
            className={cn(
              'flex items-center gap-3 rounded-[var(--sr-radius-sm)] px-3 py-2',
              isMe
                ? 'border-2 border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)]'
                : 'bg-[var(--sr-bg-elevated)]',
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                medalClass,
              )}
              aria-label={pl.challengeRankPosition(entry.rank)}
            >
              {entry.rank <= 3 ? <Medal size={16} aria-hidden /> : entry.rank}
            </span>
            <span className="min-w-0 flex-1 truncate sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
              {entry.display_name || pl.challengeAnonymous}
              {isMe && (
                <span className="ml-1.5 text-[var(--sr-brand-primary)]">({pl.challengeYouLabel})</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-[var(--sr-text-primary)]">
              {entry.total_reps}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ─── Submit sheet ─── */

function SubmitSheet({
  open,
  onClose,
  challenge,
  existingEntry,
  displayName,
  onSubmitted,
}: {
  open: boolean
  onClose: () => void
  challenge: WeeklyChallenge
  existingEntry: ChallengeEntry | null
  displayName: string
  onSubmitted: () => void
}) {
  const [reps, setReps] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [hasEnded, setHasEnded] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (open) {
      setReps(existingEntry ? String(existingEntry.total_reps) : '')
      setError('')
      setHasEnded(new Date(challenge.ends_at).getTime() <= Date.now())
    }
  }, [open, existingEntry, challenge.ends_at])

  const handleSubmit = useCallback(async () => {
    // Re-check hasEnded at submit time (challenge may have expired while sheet was open)
    if (new Date(challenge.ends_at).getTime() <= Date.now()) {
      setError(pl.challengeNotActive)
      return
    }
    const trimmed = reps.trim()
    if (trimmed === '') {
      setError(pl.challengeInvalidReps)
      return
    }
    const num = Number(trimmed)
    if (!Number.isFinite(num) || num < 0 || num > 100000) {
      setError(pl.challengeInvalidReps)
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await submitWeeklyChallengeEntry({
        challengeId: challenge.id,
        totalReps: Math.round(num),
        displayName,
      })
      if (!mountedRef.current) return
      showToast(
        result.is_new_best ? pl.challengeNewBest : pl.challengeNotBest,
        result.is_new_best ? 'success' : 'info',
      )
      onSubmitted()
      onClose()
    } catch (e) {
      if (!mountedRef.current) return
      const msg = e instanceof Error ? e.message : ''
      if (msg === 'not_authenticated') setError(pl.challengeLoginRequired)
      else if (msg === 'challenge_not_active') setError(pl.challengeNotActive)
      else if (msg === 'invalid_reps') setError(pl.challengeInvalidReps)
      else setError(pl.communityErrorGeneric)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [reps, challenge, displayName, onSubmitted, onClose])

  return (
    <Sheet open={open} onClose={onClose} title={pl.challengeSubmit}>
      <div className="flex flex-col gap-4">
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.challengeSubmitHint}
        </p>

        {error && <FeedbackBanner variant="error" message={error} />}

        {hasEnded && (
          <FeedbackBanner variant="warning" message={pl.challengeEnded} />
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="challenge-reps" className="sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
            {pl.challengeRepsLabel}
          </label>
          <input
            id="challenge-reps"
            type="number"
            inputMode="numeric"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder={pl.challengeRepsPlaceholder}
            min={0}
            max={100000}
            aria-describedby={existingEntry ? 'challenge-existing' : undefined}
            className={cn(
              FOCUS_RING,
              'w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5 sr-text-body text-[var(--sr-text-primary)] placeholder:text-[var(--sr-text-muted)]',
            )}
          />
        </div>

        {existingEntry && (
          <p id="challenge-existing" className="sr-text-caption text-[var(--sr-text-muted)]">
            {pl.challengeYourResult}: <span className="font-semibold">{existingEntry.total_reps}</span>
          </p>
        )}

        <div className="flex gap-2.5">
          <Button fullWidth disabled={busy || reps.trim() === '' || hasEnded} onClick={handleSubmit}>
            {busy && <Loader2 size={18} className="animate-spin" aria-hidden />}
            {pl.challengeSubmit}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {pl.challengeCancel}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/* ─── Main card ─── */

export function WeeklyChallengeCard() {
  const online = useOnline()
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const displayName = useAppStore((s) => s.settings.displayName ?? '')
  const [challenge, setChallenge] = useState<WeeklyChallenge | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [myEntry, setMyEntry] = useState<ChallengeEntry | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured || !online) {
      setLoading(false)
      return
    }
    const reqId = ++requestIdRef.current
    try {
      const ch = await getActiveWeeklyChallenge()
      if (!mountedRef.current || reqId !== requestIdRef.current) return
      setChallenge(ch)
      if (ch) {
        const { data: authData } = await supabase.auth.getUser()
        if (!mountedRef.current || reqId !== requestIdRef.current) return
        const userId = authData.user?.id ?? null
        setCurrentUserId(userId)

        const [board, mine, count] = await Promise.all([
          getWeeklyChallengeLeaderboard(ch.id),
          userId ? getMyWeeklyChallengeEntry(ch.id) : Promise.resolve(null),
          getWeeklyChallengeParticipantCount(ch.id),
        ])
        if (!mountedRef.current || reqId !== requestIdRef.current) return
        setLeaderboard(board)
        setMyEntry(mine)
        setParticipantCount(count)
      }
    } catch {
      // Offline or error — leave empty
    } finally {
      if (mountedRef.current && reqId === requestIdRef.current) setLoading(false)
    }
  }, [online])

  useEffect(() => {
    void reload()
  }, [reload])

  // Refresh on window focus (user returns from another tab)
  useEffect(() => {
    if (!online) return
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload, online])

  if (!isSupabaseConfigured || !online) return null
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={20} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
      </div>
    )
  }
  if (!challenge) return null  // No active challenge — don't show empty card

  const daysLeft = daysUntil(challenge.ends_at)
  const hasEnded = daysLeft <= 0
  const progressPct = myEntry
    ? Math.min(100, Math.round((myEntry.total_reps / challenge.target_reps) * 100))
    : 0

  return (
    <section
      className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-gradient-to-br from-[var(--sr-brand-primary-muted)] to-[var(--sr-bg-elevated)] p-4"
      aria-label={pl.challengeTitle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-[var(--sr-brand-primary)]" aria-hidden />
            <h2 className="sr-text-h3">{pl.challengeTitle}</h2>
          </div>
          <p className="mt-0.5 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.challengeWeekKey(challenge.week_key)}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--sr-bg-surface)] px-2 py-1 sr-text-caption text-[var(--sr-text-secondary)]">
          {programLabel(challenge.program)}
        </span>
      </div>

      {/* Title + description */}
      <div className="mt-3">
        <p className="sr-text-body font-semibold text-[var(--sr-text-primary)]">
          {challenge.title}
        </p>
        {challenge.description && (
          <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
            {challenge.description}
          </p>
        )}
      </div>

      {/* Meta — target, days left, participants */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
          <Target size={14} aria-hidden />
          {pl.challengeTarget(challenge.target_reps)}
        </span>
        <span className="flex items-center gap-1.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
          <Clock size={14} aria-hidden />
          {hasEnded ? pl.challengeEnded : pl.challengeEndsIn(daysLeft)}
        </span>
        <span className="flex items-center gap-1.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
          <Users size={14} aria-hidden />
          {pl.challengeParticipants(participantCount)}
        </span>
      </div>

      {/* Your result + progress bar */}
      {myEntry && (
        <div className="mt-3">
          <div className="flex items-center justify-between sr-text-caption text-[var(--sr-text-secondary)]">
            <span>{pl.challengeYourResult}</span>
            <span className="tabular-nums font-semibold text-[var(--sr-text-primary)]">
              {pl.challengeProgressLabel(myEntry.total_reps, challenge.target_reps)}
            </span>
          </div>
          <div
            className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--sr-bg-surface)]"
            role="progressbar"
            aria-label={pl.challengeProgressAria(myEntry.total_reps, challenge.target_reps)}
            aria-valuenow={Math.min(myEntry.total_reps, challenge.target_reps)}
            aria-valuemin={0}
            aria-valuemax={challenge.target_reps}
          >
            <div
              className="h-full rounded-full bg-[var(--sr-brand-primary)] transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Ended banner */}
      {hasEnded && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.challengeEndedHint}
        </div>
      )}

      {/* CTA — only when challenge is active and user is logged in */}
      {onboardingComplete && !hasEnded && currentUserId && (
        <div className="mt-4">
          <Button
            fullWidth
            variant={myEntry ? 'secondary' : 'primary'}
            onClick={() => setSubmitOpen(true)}
          >
            <Send size={16} aria-hidden />
            {myEntry ? pl.challengeSubmit : pl.challengeJoin}
          </Button>
        </div>
      )}

      {/* Login prompt for not-logged-in users */}
      {onboardingComplete && !hasEnded && !currentUserId && (
        <p className="mt-3 sr-text-caption text-[var(--sr-text-muted)]">
          {pl.challengeLoginRequired}
        </p>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-3">
          <h3 className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.challengeLeaderboard}
          </h3>
          <Leaderboard entries={leaderboard} currentUserId={currentUserId} />
        </div>
      )}

      {/* Submit sheet */}
      {submitOpen && (
        <SubmitSheet
          open={submitOpen}
          onClose={() => setSubmitOpen(false)}
          challenge={challenge}
          existingEntry={myEntry}
          displayName={displayName}
          onSubmitted={reload}
        />
      )}
    </section>
  )
}
