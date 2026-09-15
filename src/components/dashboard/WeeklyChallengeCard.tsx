import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Loader2, Users, Clock, Medal,
  ChevronRight, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ux/Feedback'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { StatusPill } from '@/components/ui/StatusPill'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { db } from '@/lib/db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { useOnline } from '@/hooks/useOnline'
import { track, AnalyticsEvents, trackError } from '@/lib/analytics'
import { scheduleAchievementCheck } from '@/lib/achievements/schedule'
import { getFollowing } from '@/lib/follow-system'
import { ChallengeUserSheet } from '@/components/dashboard/ChallengeUserSheet'
import { ChallengeDetailSheet } from '@/components/dashboard/challenge/ChallengeDetailSheet'
import {
  daysUntil,
  programLabel,
  progressLabel,
  typeTitle,
  TYPE_COLOR,
  TYPE_ICON,
  MEDAL_CLASS,
} from '@/components/dashboard/challenge/challenge-ui'
import {
  getActiveWeeklyChallenges,
  getWeeklyChallengeLeaderboard,
  getWeeklyChallengeParticipantCount,
  getActiveWeekParticipantCount,
  getMonthlyChallengeLeaderboard,
  calculateAllChallengeProgress,
  autoSubmitChallengeProgress,
  ensureWeeklyChallenge,
  selectRelevantChallenges,
  type WeeklyChallenge,
  type ChallengeProgress,
  type LeaderboardEntry,
  type MonthlyLeaderboardEntry,
  type ScoredChallenge,
} from '@/lib/weekly-challenge'
import type { Program } from '@/data/plans/types'

// ── Monthly leaderboard (cross-week points ranking) ──

function MonthlyLeaderboard({
  entries,
  currentUserId,
  followingIds,
  onSelectUser,
}: {
  entries: MonthlyLeaderboardEntry[]
  currentUserId: string | null
  followingIds: Set<string>
  onSelectUser: (userId: string, name: string) => void
}) {
  if (entries.length === 0) {
    return <EmptyState title={pl.challengeMonthlyEmpty} />
  }
  return (
    <ol className="space-y-1.5" aria-label={pl.challengeViewMonthly}>
      {entries.map((entry) => {
        const isMe = entry.user_id === currentUserId
        const isFollowed = followingIds.has(entry.user_id)
        const medalClass = MEDAL_CLASS[entry.rank] ?? 'text-[var(--sr-text-muted)]'
        const name = entry.display_name || pl.challengeAnonymous
        const content = (
          <>
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                medalClass,
              )}
              aria-label={pl.challengeRankPosition(entry.rank)}
            >
              {entry.rank <= 3 ? <Medal size={16} aria-hidden /> : entry.rank}
            </span>
            <span className="min-w-0 flex-1 break-words">
              <span className="block sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                {name}
                {isMe && (
                  <span className="ml-1.5 text-[var(--sr-brand-primary)]">({pl.challengeYouLabel})</span>
                )}
                {!isMe && isFollowed && (
                  <span className="ml-1.5 sr-text-caption text-[var(--sr-text-muted)]">· {pl.followingButton}</span>
                )}
              </span>
              <span className="block sr-text-caption text-[var(--sr-text-muted)]">
                {pl.challengeMonthlyCompleted(entry.completed)}
              </span>
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-[var(--sr-brand-primary)]">
              {pl.challengePoints(entry.points)}
            </span>
          </>
        )
        return (
          <li
            key={entry.user_id}
            className={cn(
              'rounded-[var(--sr-radius-sm)]',
              isMe
                ? 'border-2 border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)]'
                : 'bg-[var(--sr-bg-elevated)]',
            )}
          >
            {isMe ? (
              <div className="flex items-start gap-3 px-3 py-2">{content}</div>
            ) : (
              <button
                type="button"
                onClick={() => onSelectUser(entry.user_id, name)}
                aria-label={pl.challengeViewUser(name)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-[var(--sr-radius-sm)] px-3 py-2 text-left transition-colors hover:bg-[var(--sr-bg-surface)] active:bg-[var(--sr-bg-surface)]',
                  FOCUS_RING,
                )}
              >
                {content}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// ── Single challenge row — compact; details + leaderboard open in a sheet ──

function ChallengeItem({
  challenge,
  progress,
  onOpenDetail,
  recommended,
}: {
  challenge: WeeklyChallenge
  progress: ChallengeProgress
  onOpenDetail: () => void
  recommended: boolean
}) {
  const Icon = TYPE_ICON[challenge.challenge_type]
  const color = TYPE_COLOR[challenge.challenge_type]
  const daysLeft = daysUntil(challenge.ends_at)
  const hasEnded = daysLeft <= 0
  const title = typeTitle(challenge.challenge_type)

  return (
    <div
      className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-2.5"
      aria-label={title}
    >
      <button
        type="button"
        onClick={onOpenDetail}
        aria-haspopup="dialog"
        className={cn('flex w-full items-start gap-2.5 rounded-[var(--sr-radius-sm)] text-left', FOCUS_RING)}
      >
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)]"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
        >
          <Icon size={16} style={{ color }} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <p className="break-words sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
              {title}
            </p>
            {recommended && !progress.achieved && (
              <StatusPill tone="brand" size="xs" className="shrink-0">
                {pl.challengeRecommended}
              </StatusPill>
            )}
            {progress.achieved && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 sr-text-caption font-medium"
                style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
              >
                ✓
              </span>
            )}
          </div>
          <p className="mt-0.5 sr-text-caption text-[var(--sr-text-muted)]">
            {programLabel(challenge.program)} · {hasEnded ? pl.challengeEnded : pl.challengeEndsIn(daysLeft)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 text-right">
          <p className="tabular-nums sr-text-body-sm font-bold text-[var(--sr-text-primary)]">
            {progressLabel(challenge.challenge_type, progress.current, progress.target)}
          </p>
          <ChevronRight size={14} className="text-[var(--sr-text-muted)]" aria-hidden />
        </div>
      </button>

      {/* Progress bar */}
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-elevated)]"
        role="progressbar"
        aria-label={pl.challengeProgressAria(progress.current, progress.target)}
        aria-valuenow={Math.min(progress.current, progress.target)}
        aria-valuemin={0}
        aria-valuemax={progress.target}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${progress.pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  )
}

// ── Main card ──

export function WeeklyChallengeCard() {
  const online = useOnline()
  const navigate = useNavigate()
  const onboardingComplete = useAppStore((s) => s.settings.onboardingComplete)
  const displayName = useAppStore((s) => s.settings.displayName ?? '')
  const enabledPrograms = useAppStore((s) => s.settings.enabledPrograms)
  const [challenges, setChallenges] = useState<WeeklyChallenge[]>([])
  const [progress, setProgress] = useState<ChallengeProgress[]>([])
  const [scoredChallenges, setScoredChallenges] = useState<ScoredChallenge[]>([])
  const [showAll, setShowAll] = useState(false)
  const [leaderboards, setLeaderboards] = useState<Map<string, LeaderboardEntry[]>>(new Map())
  const [participantCounts, setParticipantCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [boardFilter, setBoardFilter] = useState<'global' | 'following'>('global')
  const [distinctParticipants, setDistinctParticipants] = useState<number | null>(null)
  const [view, setView] = useState<'challenges' | 'monthly'>('challenges')
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string } | null>(null)
  /** null = RPC unavailable or load failed; [] = deployed, no entries yet. */
  const [monthlyBoard, setMonthlyBoard] = useState<MonthlyLeaderboardEntry[] | null>(null)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)
  /** Last submitted progress value per challenge — avoids re-submitting an
   *  unchanged value on every window focus (server upsert is a no-op, but
   *  the RPC call itself costs a round-trip × up to 12 challenges). */
  const submittedRef = useRef<Map<string, number>>(new Map())

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
      let active = await getActiveWeeklyChallenges()
      if (!mountedRef.current || reqId !== requestIdRef.current) return

      // Auto-create challenges if none exist
      if (active.length === 0) {
        try {
          await ensureWeeklyChallenge()
          active = await getActiveWeeklyChallenges()
          if (!mountedRef.current || reqId !== requestIdRef.current) return
        } catch {
          // Auto-create failed — fall through
        }
      }

      // Filter to user's enabled programs
      const relevant = active.filter((ch) => {
        const prog = ch.program as Program
        return enabledPrograms?.includes(prog) ?? true
      })

      setChallenges(relevant)
      setLoadError(false)

      if (relevant.length > 0) {
        // Get user ID
        const { data: authData } = await supabase.auth.getUser()
        if (!mountedRef.current || reqId !== requestIdRef.current) return
        const userId = authData.user?.id ?? null
        setCurrentUserId(userId)

        // Calculate progress from local session data (anti-cheat).
        // One shared session snapshot — previously every challenge did its
        // own full-table scan (~24 scans for 12 challenges).
        try {
          const allSessions = await db.workoutSessions
            .where('status')
            .equals('completed')
            .toArray()
          const prog = await calculateAllChallengeProgress(relevant, allSessions)
          if (!mountedRef.current || reqId !== requestIdRef.current) return
          setProgress(prog)

          // Select top 3 most relevant challenges for this user
          const scored = await selectRelevantChallenges(relevant, prog, 3, allSessions)
          if (!mountedRef.current || reqId !== requestIdRef.current) return
          setScoredChallenges(scored)

          // Auto-submit progress to server for leaderboard — only challenges
          // whose progress increased since the last successful submit.
          // Awaited before the leaderboard fetch below: otherwise the monthly
          // board renders pre-submit points (stale) right after a workout.
          if (userId && displayName) {
            const pairs = relevant
              .map((ch, i) => ({ ch, p: prog[i] }))
              .filter(
                (x): x is { ch: WeeklyChallenge; p: ChallengeProgress } =>
                  !!x.p &&
                  x.p.current > 0 &&
                  x.p.current > (submittedRef.current.get(x.ch.id) ?? -1),
              )
            if (pairs.length > 0) {
              try {
                const done = await autoSubmitChallengeProgress(
                  pairs.map((x) => x.ch),
                  pairs.map((x) => x.p),
                  displayName,
                )
                for (const { ch, p } of pairs) {
                  if (done.has(ch.id)) submittedRef.current.set(ch.id, p.current)
                }
                scheduleAchievementCheck()
              } catch {
                // Non-critical — leaderboard just won't update this pass
              }
            }
          }
        } catch (err) {
          trackError(err, 'challenge.progress')
        }

        // Load following list for social filter
        if (userId) {
          try {
            const following = await getFollowing(200)
            if (!mountedRef.current || reqId !== requestIdRef.current) return
            setFollowingIds(new Set(following.map((f) => f.followee_id)))
          } catch {
            // Non-critical
          }
        }

        // Load leaderboards, per-challenge counts and the distinct
        // participant count for the whole week (migration 065; null →
        // the card falls back to summing per-challenge counts).
        const [boards, counts, distinctCount, monthly] = await Promise.all([
          Promise.all(relevant.map((ch) => getWeeklyChallengeLeaderboard(ch.id).catch(() => []))),
          Promise.all(relevant.map((ch) => getWeeklyChallengeParticipantCount(ch.id).catch(() => 0))),
          getActiveWeekParticipantCount().catch(() => null),
          getMonthlyChallengeLeaderboard().catch(() => null),
        ])
        if (!mountedRef.current || reqId !== requestIdRef.current) return
        setDistinctParticipants(distinctCount)
        setMonthlyBoard(monthly)

        const boardMap = new Map<string, LeaderboardEntry[]>()
        const countMap = new Map<string, number>()
        relevant.forEach((ch, i) => {
          boardMap.set(ch.id, boards[i])
          countMap.set(ch.id, counts[i])
        })
        setLeaderboards(boardMap)
        setParticipantCounts(countMap)

        track(AnalyticsEvents.challengeView, {
          count: relevant.length,
          types: relevant.map((c) => c.challenge_type).join(','),
        })
      }
    } catch {
      setLoadError(true)
    } finally {
      if (mountedRef.current && reqId === requestIdRef.current) setLoading(false)
    }
  }, [online, enabledPrograms, displayName])

  useEffect(() => {
    void reload()
  }, [reload])

  // Refresh on window focus
  useEffect(() => {
    if (!online) return
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload, online])

  const handleSelectUser = useCallback((userId: string, name: string) => {
    setSelectedUser({ userId, name })
    track(AnalyticsEvents.challengeUserOpen)
  }, [])

  // Keep the leaderboard's "following" markers + filter in sync with
  // follow/unfollow actions taken inside the user sheet.
  const handleFollowToggled = useCallback((userId: string, following: boolean) => {
    setFollowingIds((prev) => {
      const next = new Set(prev)
      if (following) next.add(userId)
      else next.delete(userId)
      return next
    })
  }, [])

  const hasFollowing = followingIds.size > 0
  // Sticky 'following' filter without any follows would show an empty
  // board with no way back (the segmented control is hidden) — coerce.
  const effectiveBoardFilter = hasFollowing ? boardFilter : 'global'
  // Same coercion for the view toggle when the monthly RPC is unavailable.
  const effectiveView = monthlyBoard !== null ? view : 'challenges'

  if (!isSupabaseConfigured || !online) return null
  if (loading) {
    return (
      <div className="flex items-center justify-center py-4" aria-busy aria-label={pl.loading}>
        <Loader2 size={20} className="animate-spin text-[var(--sr-text-muted)]" aria-hidden />
      </div>
    )
  }
  if (loadError && challenges.length === 0) return null
  if (challenges.length === 0) return null

  // Distinct users beat the per-challenge sum (same user counted N times).
  const totalParticipants =
    distinctParticipants ?? Array.from(participantCounts.values()).reduce((a, b) => a + b, 0)
  const daysLeft = challenges[0] ? daysUntil(challenges[0].ends_at) : 0
  const hasEnded = daysLeft <= 0
  const isUrgent = !hasEnded && daysLeft <= 2
  const weekKey = challenges[0]?.week_key ?? ''

  // Check if all displayed challenges are achieved
  const displayedChallenges = showAll ? challenges : scoredChallenges.map((s) => s.challenge)
  const allAchieved = displayedChallenges.length > 0 && displayedChallenges.every((ch) => {
    const idx = challenges.indexOf(ch)
    const p = progress[idx]
    return p?.achieved ?? false
  })

  return (
    <section
      className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-gradient-to-br from-[var(--sr-brand-primary-muted)] to-[var(--sr-bg-elevated)] p-3.5"
      aria-label={pl.challengeTitle}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-[var(--sr-brand-primary)]" aria-hidden />
            <h3 className="sr-text-h3">{pl.challengeTitle}</h3>
          </div>
          <p className="mt-0.5 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.challengeWeekKey(weekKey)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={cn(
            'flex items-center gap-1.5 sr-text-caption',
            isUrgent ? 'font-semibold text-[var(--sr-warning)]' : 'text-[var(--sr-text-secondary)]',
          )}>
            <Clock size={12} aria-hidden />
            {hasEnded ? pl.challengeEnded : isUrgent ? pl.challengeUrgent : pl.challengeEndsIn(daysLeft)}
          </p>
          <p className="mt-0.5 flex items-center justify-end gap-1.5 sr-text-caption text-[var(--sr-text-muted)]">
            <Users size={12} aria-hidden />
            {pl.challengeParticipants(totalParticipants)}
          </p>
        </div>
      </div>

      {/* Login prompt for not-logged-in users */}
      {onboardingComplete && !currentUserId && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.challengeLoginRequired}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={() => navigate('/setup/login')}
          >
            {pl.loginContinue}
          </Button>
        </div>
      )}

      {/* Logged in but no display name → progress is tracked locally but
          never reaches the leaderboard. Tell the user why. */}
      {onboardingComplete && currentUserId && !displayName.trim() && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5">
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
            {pl.challengeNameRequired}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-1"
            onClick={() => navigate('/profile?edit=profile')}
          >
            {pl.challengeSetNameCta}
          </Button>
        </div>
      )}

      {/* View toggle — weekly challenges vs monthly points ranking.
          Hidden when the monthly RPC isn't deployed (null). */}
      {monthlyBoard !== null && (
        <SegmentedControl
          aria-label={pl.challengeTitle}
          className="mt-3"
          stretch
          value={view}
          onChange={setView}
          options={[
            { label: pl.challengeViewChallenges, value: 'challenges' },
            { label: pl.challengeViewMonthly, value: 'monthly' },
          ]}
        />
      )}

      {/* Monthly points ranking */}
      {effectiveView === 'monthly' && monthlyBoard !== null && (
        <div className="mt-2.5">
          <MonthlyLeaderboard
            entries={monthlyBoard}
            currentUserId={currentUserId}
            followingIds={followingIds}
            onSelectUser={handleSelectUser}
          />
          <p className="mt-2 sr-text-caption text-[var(--sr-text-muted)]">
            {pl.challengeMonthlyHowPoints}
          </p>
        </div>
      )}

      {/* Challenge list */}
      {effectiveView === 'challenges' && (
      <div className="mt-2.5 flex flex-col gap-2">
        {(showAll ? challenges : scoredChallenges.map((s) => s.challenge)).map((ch) => {
          const idx = challenges.indexOf(ch)
          const p = progress[idx] ?? {
            challengeId: ch.id,
            challengeType: ch.challenge_type,
            program: ch.program as Program,
            current: 0,
            target: ch.target_reps,
            achieved: false,
            pct: 0,
          }
          const scored = scoredChallenges.find((s) => s.challenge.id === ch.id)
          return (
            <ChallengeItem
              key={ch.id}
              challenge={ch}
              progress={p}
              onOpenDetail={() => {
                setDetailId(ch.id)
                track(AnalyticsEvents.challengeLeaderboardToggle, { challengeId: ch.id })
              }}
              recommended={scored?.recommended ?? false}
            />
          )
        })}
      </div>
      )}

      {/* All achieved celebration */}
      {effectiveView === 'challenges' && allAchieved && !hasEnded && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)] px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="shrink-0 text-[var(--sr-success)]" aria-hidden />
            <div className="min-w-0">
              <p className="sr-text-body-sm font-semibold text-[var(--sr-success)]">
                {pl.challengeAllAchieved}
              </p>
              <p className="mt-0.5 sr-text-caption text-[var(--sr-text-secondary)]">
                {pl.challengeAllAchievedHint}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Show all / show top toggle */}
      {effectiveView === 'challenges' && scoredChallenges.length > 0 && challenges.length > scoredChallenges.length && (
        <button
          type="button"
          className={cn(
            FOCUS_RING,
            'mt-2.5 w-full rounded-[var(--sr-radius-sm)] py-2 sr-text-body-sm font-medium text-[var(--sr-brand-primary)] transition-colors hover:bg-[var(--sr-brand-primary-muted)]',
          )}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? pl.challengeShowTop : pl.challengeShowAll(challenges.length)}
        </button>
      )}

      {/* Ended banner */}
      {effectiveView === 'challenges' && hasEnded && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.challengeEndedHint}
        </div>
      )}

      {/* Challenge detail — description, personal context, leaderboard */}
      {detailId && (() => {
        const ch = challenges.find((c) => c.id === detailId)
        if (!ch) return null
        const idx = challenges.indexOf(ch)
        const p = progress[idx] ?? {
          challengeId: ch.id,
          challengeType: ch.challenge_type,
          program: ch.program as Program,
          current: 0,
          target: ch.target_reps,
          achieved: false,
          pct: 0,
        }
        const scored = scoredChallenges.find((s) => s.challenge.id === ch.id)
        return (
          <ChallengeDetailSheet
            challenge={ch}
            progress={p}
            leaderboard={leaderboards.get(ch.id) ?? []}
            context={scored?.context ?? null}
            currentUserId={currentUserId}
            followingIds={followingIds}
            boardFilter={effectiveBoardFilter}
            hasFollowing={hasFollowing}
            onBoardFilterChange={setBoardFilter}
            onSelectUser={handleSelectUser}
            onClose={() => setDetailId(null)}
          />
        )
      })()}

      {/* User sheet — tap a leaderboard row to view profile + follow */}
      <ChallengeUserSheet
        userId={selectedUser?.userId ?? null}
        displayName={selectedUser?.name ?? ''}
        isFollowing={selectedUser ? followingIds.has(selectedUser.userId) : false}
        onToggled={handleFollowToggled}
        onClose={() => setSelectedUser(null)}
      />
    </section>
  )
}
