import { useMemo } from 'react'
import { Medal, ShieldCheck } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import {
  MEDAL_CLASS,
  categoryLabel,
  programLabel,
  progressLabel,
  typeDescription,
  typeTitle,
} from './challenge-ui'
import { typeCategory } from '@/lib/weekly-challenge'
import type {
  ChallengeContext,
  ChallengeProgress,
  LeaderboardEntry,
  WeeklyChallenge,
} from '@/lib/weekly-challenge'

/** Single leaderboard — used inside ChallengeDetailSheet (moved out of the
 *  challenge row so the card no longer nests 3 expandable boards). */
function Leaderboard({
  entries,
  challenge,
  currentUserId,
  followingIds,
  onSelectUser,
}: {
  entries: LeaderboardEntry[]
  challenge: WeeklyChallenge
  currentUserId: string | null
  followingIds: Set<string>
  onSelectUser: (userId: string, name: string) => void
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
            <span className="min-w-0 flex-1 break-words sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
              {name}
              {isMe && (
                <span className="ml-1.5 text-[var(--sr-brand-primary)]">({pl.challengeYouLabel})</span>
              )}
              {!isMe && isFollowed && (
                <span className="ml-1.5 sr-text-caption text-[var(--sr-text-muted)]">· {pl.followingButton}</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums font-semibold text-[var(--sr-text-primary)]">
              {progressLabel(challenge.challenge_type, entry.total_reps, challenge.target_reps)}
            </span>
          </>
        )
        return (
          <li
            key={entry.id}
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

/** Challenge detail — description, personal context and the leaderboard.
 *  Lives in a Sheet so the dashboard card stays a compact list. */
export function ChallengeDetailSheet({
  challenge,
  progress,
  leaderboard,
  context,
  currentUserId,
  followingIds,
  boardFilter,
  hasFollowing,
  onBoardFilterChange,
  onSelectUser,
  onClose,
}: {
  challenge: WeeklyChallenge
  progress: ChallengeProgress
  leaderboard: LeaderboardEntry[]
  context: ChallengeContext | null
  currentUserId: string | null
  followingIds: Set<string>
  boardFilter: 'global' | 'following'
  hasFollowing: boolean
  onBoardFilterChange: (v: 'global' | 'following') => void
  onSelectUser: (userId: string, name: string) => void
  onClose: () => void
}) {
  const filteredBoard = useMemo(() => {
    if (boardFilter === 'following') {
      return leaderboard.filter((e) => followingIds.has(e.user_id))
    }
    return leaderboard
  }, [leaderboard, boardFilter, followingIds])

  return (
    <Sheet open onClose={onClose} title={typeTitle(challenge.challenge_type)} showClose>
      <div className="pb-2">
        <p className="sr-text-overline text-[var(--sr-text-muted)]">
          {categoryLabel(typeCategory(challenge.challenge_type))} · {programLabel(challenge.program)}
        </p>
        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {typeDescription(challenge.challenge_type, challenge.target_reps, challenge.starts_at)}
        </p>
        <p className="mt-1.5 sr-text-body-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
          {progressLabel(challenge.challenge_type, progress.current, progress.target)}
        </p>
        {/* Progress bar — same target as the card row */}
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-elevated)]"
          role="progressbar"
          aria-label={pl.challengeProgressAria(progress.current, progress.target)}
          aria-valuenow={Math.max(0, Math.min(progress.current, progress.target))}
          aria-valuemin={0}
          aria-valuemax={progress.target}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${progress.pct}%`, backgroundColor: 'var(--sr-brand-primary)' }}
          />
        </div>

        {/* Personal context: recent average (or the record to beat) + difficulty */}
        {(() => {
          if (!context) return null
          // Record-beat types show the bar with a "record" label — calling it
          // an average would be misleading. Difficulty chip is hidden too: a
          // binary record goal can't be rated from a target/average ratio.
          const isRecordType =
            challenge.challenge_type === 'personal_best' ||
            challenge.challenge_type === 'volume_record' ||
            challenge.challenge_type === 'session_record' ||
            challenge.challenge_type === 'day_record' ||
            challenge.challenge_type === 'beat_average'
          if (isRecordType) {
            if (context.previousMax <= 0) return null
            return (
              <div className="mt-3 sr-text-caption text-[var(--sr-text-muted)]">
                {challenge.challenge_type === 'beat_average'
                  ? pl.challengeYourAverage(context.previousMax)
                  : pl.challengeYourBest(context.previousMax)}
              </div>
            )
          }
          if (context.recentAverage <= 0 && context.previousMax <= 0) return null
          // The context value isn't always a weekly average — max_set holds
          // the best set, big_day the best day, marathon a per-session mean,
          // improvement last week's total. Label must match the semantics.
          const contextLabel = (() => {
            switch (challenge.challenge_type) {
              case 'max_set':
                return pl.challengeYourBestSet(context.recentAverage)
              case 'big_day':
                return pl.challengeYourBestDay(context.recentAverage)
              case 'marathon':
                return pl.challengeYourAvgSession(context.recentAverage)
              case 'grinder':
                return pl.challengeYourAvgSets(context.recentAverage)
              case 'improvement':
                return pl.challengeYourLastWeek(context.previousMax)
              default:
                return pl.challengeYourAverage(context.recentAverage)
            }
          })()
          return (
            <div className="mt-3 flex items-center gap-2 sr-text-caption text-[var(--sr-text-muted)]">
              <span>{contextLabel}</span>
              <span className="text-[var(--sr-text-muted)]">·</span>
              <span
                className={cn(
                  'font-medium',
                  context.difficulty === 'easy' && 'text-[var(--sr-success)]',
                  context.difficulty === 'challenging' && 'text-[var(--sr-warning)]',
                  context.difficulty === 'hard' && 'text-[var(--sr-error)]',
                  context.difficulty === 'unknown' && 'text-[var(--sr-text-muted)]',
                )}
              >
                {context.difficulty === 'easy' && pl.challengeDifficultyEasy}
                {context.difficulty === 'challenging' && pl.challengeDifficultyChallenging}
                {context.difficulty === 'hard' && pl.challengeDifficultyHard}
                {context.difficulty === 'unknown' && pl.challengeDifficultyUnknown}
              </span>
            </div>
          )
        })()}

        {/* Auto-tracked badge */}
        <div className="mt-3 flex items-center gap-1.5">
          <ShieldCheck size={12} className="text-[var(--sr-success)]" aria-hidden />
          <span className="sr-text-caption text-[var(--sr-text-muted)]">
            {pl.challengeAutoTracked}
          </span>
        </div>

        {/* Leaderboard */}
        <div className="mt-4 border-t border-[var(--sr-border-subtle)] pt-3">
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
              challenge={challenge}
              currentUserId={currentUserId}
              followingIds={followingIds}
              onSelectUser={onSelectUser}
            />
          )}
        </div>
      </div>
    </Sheet>
  )
}
