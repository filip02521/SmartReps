import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, ChevronRight, Sparkles } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { useOnline } from '@/hooks/useOnline'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { allSetsPassed } from '@/lib/progress-engine'
import {
  getActiveWeeklyChallenges,
  calculateAllChallengeProgress,
  type WeeklyChallenge,
  type ChallengeProgress,
  type ChallengeType,
} from '@/lib/weekly-challenge'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'

const TYPE_LABEL: Record<ChallengeType, string> = {
  volume: pl.challengeTypeVolume,
  consistency: pl.challengeTypeConsistency,
  precision: pl.challengeTypePrecision,
  personal_best: pl.challengeTypePersonalBest,
}

function progressLabel(type: ChallengeType, current: number, target: number): string {
  if (type === 'consistency') return pl.challengeProgressSessions(current, target)
  if (type === 'personal_best') return pl.challengeProgressPersonalBest(current, target)
  return pl.challengeProgressReps(current, target)
}

/** Calculate this session's contribution to a challenge type. */
function sessionContribution(
  type: ChallengeType,
  session: LocalWorkoutSession,
): { value: number; label: string } | null {
  switch (type) {
    case 'volume': {
      const reps = session.setResults.reduce((sum, r) => sum + Math.max(0, r.actual ?? 0), 0)
      return reps > 0 ? { value: reps, label: pl.challengeRecapContributionReps(reps) } : null
    }
    case 'consistency':
      return { value: 1, label: pl.challengeRecapContributionSession }
    case 'precision': {
      const passed = session.setResults.length > 0 && allSetsPassed(session.setResults)
      return passed ? { value: 1, label: pl.challengeRecapContributionPrecision } : null
    }
    case 'personal_best': {
      const maxSet = session.setResults.reduce((max, r) => Math.max(max, r.actual ?? 0), 0)
      return maxSet > 0 ? { value: maxSet, label: pl.challengeRecapContributionReps(maxSet) } : null
    }
  }
}

/** Remaining amount to reach the target. */
function remainingLabel(
  type: ChallengeType,
  current: number,
  target: number,
): string | null {
  const remaining = target - current
  if (remaining <= 0) return null
  // Only show encouragement when close (≤ 25% remaining)
  if (remaining > target * 0.25) return null
  if (type === 'consistency') return pl.challengeRecapRemainingSessions(remaining)
  return pl.challengeRecapRemainingReps(remaining)
}

/**
 * Compact recap of challenge progress shown after a workout.
 * Only renders if the user has active challenges for this program.
 * Gracefully returns null if API is unavailable.
 */
export function ChallengeProgressRecap({
  program,
  session,
}: {
  program: Program
  session: LocalWorkoutSession | null | undefined
}) {
  const online = useOnline()
  const navigate = useNavigate()
  const [challenges, setChallenges] = useState<WeeklyChallenge[]>([])
  const [progress, setProgress] = useState<ChallengeProgress[]>([])
  const [loaded, setLoaded] = useState(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured || !online) {
      setLoaded(true)
      return
    }
    let cancelled = false

    async function load() {
      try {
        const active = await getActiveWeeklyChallenges()
        if (cancelled || !mountedRef.current) return

        // Filter to this workout's program only
        const relevant = active.filter((ch) => ch.program === program)
        if (relevant.length === 0) {
          setLoaded(true)
          return
        }

        setChallenges(relevant)

        const prog = await calculateAllChallengeProgress(relevant)
        if (cancelled || !mountedRef.current) return
        setProgress(prog)
        setLoaded(true)
      } catch {
        if (!cancelled && mountedRef.current) setLoaded(true)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [online, program])

  if (!loaded || challenges.length === 0) return null

  // Sort: achieved first, then by progress descending
  const sorted = challenges
    .map((ch, i) => ({ ch, p: progress[i] }))
    .filter((x) => x.p)
    .sort((a, b) => {
      if (a.p!.achieved && !b.p!.achieved) return -1
      if (!a.p!.achieved && b.p!.achieved) return 1
      return b.p!.pct - a.p!.pct
    })
    .slice(0, 3)

  if (sorted.length === 0) return null

  const anyAchieved = sorted.some((s) => s.p!.achieved)

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className={cn(
          'flex w-full items-center gap-2 text-left',
        )}
        aria-label={anyAchieved ? pl.challengeRecapAchieved : pl.challengeRecapTitle}
      >
        <Trophy size={16} className="text-[var(--sr-brand-primary)]" aria-hidden />
        <h3 className="sr-text-overline font-semibold text-[var(--sr-text-muted)]">
          {anyAchieved ? pl.challengeRecapAchieved : pl.challengeRecapTitle}
        </h3>
        <ChevronRight size={14} className="ml-auto text-[var(--sr-text-muted)]" aria-hidden />
      </button>

      <ul className="mt-2 flex flex-col gap-2">
        {sorted.map(({ ch, p }) => {
          const contribution = session ? sessionContribution(ch.challenge_type, session) : null
          const remaining = remainingLabel(ch.challenge_type, p!.current, p!.target)
          return (
            <li
              key={ch.id}
              className={cn(
                'rounded-[var(--sr-radius-sm)] border px-3 py-2',
                p!.achieved
                  ? 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)]'
                  : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-1.5">
                  {p!.achieved && <Sparkles size={12} className="shrink-0 text-[var(--sr-success)]" aria-hidden />}
                  <span className="min-w-0 break-words sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                    {TYPE_LABEL[ch.challenge_type]}
                  </span>
                </div>
                <span
                  className={cn(
                    'shrink-0 tabular-nums sr-text-caption font-semibold',
                    p!.achieved
                      ? 'text-[var(--sr-success)]'
                      : 'text-[var(--sr-text-muted)]',
                  )}
                >
                  {p!.achieved
                    ? pl.challengeRecapDone
                    : progressLabel(ch.challenge_type, p!.current, p!.target)}
                </span>
              </div>

              {/* Progress bar */}
              <div
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--sr-bg-elevated)]"
                role="progressbar"
                aria-label={pl.challengeProgressAria(p!.current, p!.target)}
                aria-valuenow={Math.min(p!.current, p!.target)}
                aria-valuemin={0}
                aria-valuemax={p!.target}
              >
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    p!.achieved
                      ? 'bg-[var(--sr-success)]'
                      : 'bg-[var(--sr-brand-primary)]',
                  )}
                  style={{ width: `${p!.pct}%` }}
                />
              </div>

              {/* Contribution + remaining encouragement */}
              <div className="mt-1.5 flex items-center gap-2 sr-text-caption">
                {contribution && !p!.achieved && (
                  <span className="font-medium text-[var(--sr-success)]">
                    {contribution.label}
                  </span>
                )}
                {remaining && !p!.achieved && (
                  <>
                    {contribution && <span className="text-[var(--sr-text-muted)]">·</span>}
                    <span className="font-medium text-[var(--sr-warning)]">
                      {remaining}
                    </span>
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
