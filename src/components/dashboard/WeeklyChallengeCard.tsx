import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, Loader2, Users, Clock, Medal, ShieldCheck,
  CalendarCheck, Crosshair, TrendingUp, ChevronDown, ChevronUp,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ux/Feedback'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { useOnline } from '@/hooks/useOnline'
import { track, AnalyticsEvents, trackError } from '@/lib/analytics'
import { scheduleAchievementCheck } from '@/lib/achievements/schedule'
import { getFollowing } from '@/lib/follow-system'
import {
  getActiveWeeklyChallenges,
  getWeeklyChallengeLeaderboard,
  getWeeklyChallengeParticipantCount,
  calculateAllChallengeProgress,
  autoSubmitChallengeProgress,
  ensureWeeklyChallenge,
  selectRelevantChallenges,
  type WeeklyChallenge,
  type ChallengeProgress,
  type LeaderboardEntry,
  type ChallengeType,
  type ScoredChallenge,
  type ChallengeContext,
} from '@/lib/weekly-challenge'
import type { Program } from '@/data/plans/types'

// ── Helpers ──

function daysUntil(endDate: string): number {
  const end = new Date(endDate).getTime()
  const now = Date.now()
  return Math.ceil((end - now) / 86400000)
}

function programLabel(program: Program): string {
  switch (program) {
    case 'pushups': return pl.pushupsProgram
    case 'pullups': return pl.pullupsProgram
    case 'squats': return pl.squatsProgram
  }
}

const TYPE_ICON: Record<ChallengeType, typeof Trophy> = {
  volume: Trophy,
  consistency: CalendarCheck,
  precision: Crosshair,
  personal_best: TrendingUp,
}

const TYPE_COLOR: Record<ChallengeType, string> = {
  volume: 'var(--sr-brand-primary)',
  consistency: 'var(--sr-info)',
  precision: 'var(--sr-success)',
  personal_best: 'var(--sr-warning)',
}

function typeTitle(type: ChallengeType): string {
  switch (type) {
    case 'volume': return pl.challengeTypeVolume
    case 'consistency': return pl.challengeTypeConsistency
    case 'precision': return pl.challengeTypePrecision
    case 'personal_best': return pl.challengeTypePersonalBest
  }
}

function typeDescription(type: ChallengeType): string {
  switch (type) {
    case 'volume': return pl.challengeDescVolume
    case 'consistency': return pl.challengeDescConsistency
    case 'precision': return pl.challengeDescPrecision
    case 'personal_best': return pl.challengeDescPersonalBest
  }
}

function progressLabel(type: ChallengeType, current: number, target: number): string {
  if (type === 'consistency') return pl.challengeProgressSessions(current, target)
  if (type === 'personal_best') return pl.challengeProgressPersonalBest(current, target)
  return pl.challengeProgressReps(current, target)
}

const MEDAL_CLASS: Record<number, string> = {
  1: 'text-[var(--sr-warning)]',
  2: 'text-[var(--sr-text-secondary)]',
  3: 'text-[var(--sr-bronze)]',
}

// ── Leaderboard ──

function Leaderboard({
  entries,
  currentUserId,
  followingIds,
}: {
  entries: LeaderboardEntry[]
  currentUserId: string | null
  followingIds: Set<string>
}) {
  if (entries.length === 0) {
    return <EmptyState title={pl.challengeLeaderboardEmpty} />
  }
  return (
    <ol className="space-y-1.5" aria-label={pl.challengeLeaderboard}>
      {entries.map((entry) => {
        const isMe = entry.user_id === currentUserId
        const isFollowed = followingIds.has(entry.user_id)
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
              {!isMe && isFollowed && (
                <span className="ml-1.5 sr-text-caption text-[var(--sr-text-muted)]">· {pl.followingButton}</span>
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

// ── Single challenge card ──

function ChallengeItem({
  challenge,
  progress,
  expanded,
  onToggleExpand,
  leaderboard,
  currentUserId,
  followingIds,
  boardFilter,
  hasFollowing,
  onBoardFilterChange,
  recommended,
  context,
}: {
  challenge: WeeklyChallenge
  progress: ChallengeProgress
  expanded: boolean
  onToggleExpand: () => void
  leaderboard: LeaderboardEntry[]
  currentUserId: string | null
  followingIds: Set<string>
  boardFilter: 'global' | 'following'
  hasFollowing: boolean
  onBoardFilterChange: (v: 'global' | 'following') => void
  recommended: boolean
  context: ChallengeContext | null
}) {
  const Icon = TYPE_ICON[challenge.challenge_type]
  const color = TYPE_COLOR[challenge.challenge_type]
  const daysLeft = daysUntil(challenge.ends_at)
  const hasEnded = daysLeft <= 0
  const title = typeTitle(challenge.challenge_type)
  const description = typeDescription(challenge.challenge_type)

  const filteredBoard = useMemo(() => {
    if (boardFilter === 'following') {
      return leaderboard.filter((e) => followingIds.has(e.user_id))
    }
    return leaderboard
  }, [leaderboard, boardFilter, followingIds])

  return (
    <div
      className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3"
      aria-label={title}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={expanded}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)]"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)` }}
        >
          <Icon size={18} style={{ color }} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
              {title}
            </p>
            {recommended && !progress.achieved && (
              <span className="shrink-0 rounded-full bg-[var(--sr-brand-primary-muted)] px-1.5 py-0.5 sr-text-caption font-semibold text-[var(--sr-brand-primary)]">
                {pl.challengeRecommended}
              </span>
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
        <div className="shrink-0 text-right">
          <p className="tabular-nums sr-text-body-sm font-bold text-[var(--sr-text-primary)]">
            {progressLabel(challenge.challenge_type, progress.current, progress.target)}
          </p>
          {expanded ? <ChevronUp size={14} className="ml-auto text-[var(--sr-text-muted)]" aria-hidden /> : <ChevronDown size={14} className="ml-auto text-[var(--sr-text-muted)]" aria-hidden />}
        </div>
      </button>

      {/* Progress bar */}
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--sr-bg-elevated)]"
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

      {/* Description + context */}
      <p className="mt-2 sr-text-caption text-[var(--sr-text-secondary)]">
        {description}
      </p>

      {/* Personal context: recent average + difficulty */}
      {context && context.recentAverage > 0 && (
        <div className="mt-1.5 flex items-center gap-2 sr-text-caption text-[var(--sr-text-muted)]">
          <span>
            {pl.challengeYourAverage(context.recentAverage)}
          </span>
          <span className="text-[var(--sr-text-muted)]">·</span>
          <span className={cn(
            'font-medium',
            context.difficulty === 'easy' && 'text-[var(--sr-success)]',
            context.difficulty === 'challenging' && 'text-[var(--sr-warning)]',
            context.difficulty === 'hard' && 'text-[var(--sr-error)]',
            context.difficulty === 'unknown' && 'text-[var(--sr-text-muted)]',
          )}>
            {context.difficulty === 'easy' && pl.challengeDifficultyEasy}
            {context.difficulty === 'challenging' && pl.challengeDifficultyChallenging}
            {context.difficulty === 'hard' && pl.challengeDifficultyHard}
            {context.difficulty === 'unknown' && pl.challengeDifficultyUnknown}
          </span>
        </div>
      )}

      {/* Auto-tracked badge */}
      <div className="mt-2 flex items-center gap-1.5">
        <ShieldCheck size={12} className="text-[var(--sr-success)]" aria-hidden />
        <span className="sr-text-caption text-[var(--sr-text-muted)]">
          {pl.challengeAutoTracked}
        </span>
      </div>

      {/* Expanded leaderboard */}
      {expanded && (
        <div className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h4 className="sr-text-overline text-[var(--sr-text-muted)]">
              {pl.challengeLeaderboard}
            </h4>
            {hasFollowing && (
              <SegmentedControl
                aria-label={pl.challengeLeaderboard}
                value={boardFilter}
                onChange={onBoardFilterChange}
                options={[
                  { label: pl.challengeLeaderboardGlobal, value: 'global' },
                  { label: pl.challengeLeaderboardFollowing, value: 'following' },
                ]}
              />
            )}
          </div>
          {boardFilter === 'following' && filteredBoard.length === 0 ? (
            <EmptyState title={pl.challengeLeaderboardFollowingEmpty} />
          ) : (
            <Leaderboard
              entries={filteredBoard}
              currentUserId={currentUserId}
              followingIds={followingIds}
            />
          )}
        </div>
      )}
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
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set())
  const [boardFilter, setBoardFilter] = useState<'global' | 'following'>('global')
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

        // Calculate progress from local session data (anti-cheat)
        try {
          const prog = await calculateAllChallengeProgress(relevant)
          if (!mountedRef.current || reqId !== requestIdRef.current) return
          setProgress(prog)

          // Select top 3 most relevant challenges for this user
          const scored = await selectRelevantChallenges(relevant, prog, 3)
          if (!mountedRef.current || reqId !== requestIdRef.current) return
          setScoredChallenges(scored)

          // Auto-submit progress to server for leaderboard
          if (userId && displayName) {
            void autoSubmitChallengeProgress(relevant, prog, displayName).then(() => {
              scheduleAchievementCheck()
            }).catch(() => {})
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

        // Load leaderboards and counts for all challenges
        const [boards, counts] = await Promise.all([
          Promise.all(relevant.map((ch) => getWeeklyChallengeLeaderboard(ch.id).catch(() => []))),
          Promise.all(relevant.map((ch) => getWeeklyChallengeParticipantCount(ch.id).catch(() => 0))),
        ])
        if (!mountedRef.current || reqId !== requestIdRef.current) return

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

  const hasFollowing = followingIds.size > 0

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

  const totalParticipants = Array.from(participantCounts.values()).reduce((a, b) => a + b, 0)
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
      className="rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-gradient-to-br from-[var(--sr-brand-primary-muted)] to-[var(--sr-bg-elevated)] p-4"
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

      {/* Challenge list */}
      <div className="mt-3 flex flex-col gap-2.5">
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
              expanded={expandedId === ch.id}
              onToggleExpand={() => {
                const newId = expandedId === ch.id ? null : ch.id
                setExpandedId(newId)
                if (newId) {
                  track(AnalyticsEvents.challengeLeaderboardToggle, { challengeId: newId })
                }
              }}
              leaderboard={leaderboards.get(ch.id) ?? []}
              currentUserId={currentUserId}
              followingIds={followingIds}
              boardFilter={boardFilter}
              hasFollowing={hasFollowing}
              onBoardFilterChange={setBoardFilter}
              recommended={scored?.recommended ?? false}
              context={scored?.context ?? null}
            />
          )
        })}
      </div>

      {/* All achieved celebration */}
      {allAchieved && !hasEnded && (
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
      {scoredChallenges.length > 0 && challenges.length > scoredChallenges.length && (
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
      {hasEnded && (
        <div className="mt-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.challengeEndedHint}
        </div>
      )}
    </section>
  )
}
