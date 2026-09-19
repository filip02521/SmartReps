import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trophy, ChevronRight, Sparkles } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { useOnline } from '@/hooks/useOnline'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { allSetsPassed } from '@/lib/progress-engine'
import { typeTitle, progressLabel } from '@/components/dashboard/challenge/challenge-ui'
import {
  getActiveWeeklyChallenges,
  calculateAllChallengeProgress,
  autoSubmitChallengeProgress,
  isKnownChallengeType,
  challengeRequiredWeekday,
  sessionsInRange,
  challengeLocalDayKey,
  orderedSets,
  setTargetReps,
  type WeeklyChallenge,
  type ChallengeProgress,
  type ChallengeType,
} from '@/lib/weekly-challenge'
import { useAppStore } from '@/stores/app-store'
import { db } from '@/lib/db'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'

function setTargetRepsOf(r: LocalWorkoutSession['setResults'][number]): number {
  return setTargetReps(r.target)
}

/** Calculate this session's contribution to a challenge type.
 *  `weekTrained` = trained sessions of the same program inside the challenge
 *  window — lets day/half-based types dedup what this session actually adds. */
function sessionContribution(
  type: ChallengeType,
  session: LocalWorkoutSession,
  startsAt: string,
  weekTrained: LocalWorkoutSession[],
): { value: number; label: string } | null {
  const sessionReps = session.setResults.reduce((sum, r) => sum + Math.max(0, r.actual ?? 0), 0)
  const sessionHour = new Date(session.startedAt).getHours()
  const sessionDay = new Date(session.startedAt).getDay()
  const trained = session.setResults.length > 0
  const met = () => ({ value: 1, label: pl.challengeRecapContributionMet })
  const reps = (n: number) => ({ value: n, label: pl.challengeRecapContributionReps(n) })
  switch (type) {
    case 'volume':
    case 'big_day':
    case 'improvement':
    case 'volume_record':
    case 'day_record':
    case 'beat_average': {
      return sessionReps > 0 ? reps(sessionReps) : null
    }
    case 'marathon':
    case 'session_record': {
      // Max-metric — "+N" would imply the reps add to the challenge value;
      // only the best session total counts, so state it without the "+".
      return sessionReps > 0
        ? { value: sessionReps, label: pl.challengeRecapContributionWorkoutTotal(sessionReps) }
        : null
    }
    case 'surplus': {
      const extra = session.setResults.reduce(
        (sum, r) => sum + Math.max(0, (r.actual ?? 0) - setTargetRepsOf(r)),
        0,
      )
      return extra > 0 ? { value: extra, label: pl.challengeRecapContributionSurplus(extra) } : null
    }
    case 'consistency':
      return trained ? { value: 1, label: pl.challengeRecapContributionSession } : null
    case 'daily': {
      if (!trained) return null
      // Only a genuinely new day contributes — a second session on an
      // already-counted day would overclaim "+1 dzień".
      const dayKey = challengeLocalDayKey(session.startedAt)
      const dayAlreadyCounted = weekTrained.some(
        (s) => s.id !== session.id && challengeLocalDayKey(s.startedAt) === dayKey,
      )
      return dayAlreadyCounted ? null : { value: 1, label: pl.challengeRecapContributionDay }
    }
    case 'grinder': {
      const sets = session.setResults.length
      return sets > 0 ? { value: sets, label: pl.challengeRecapContributionSets(sets) } : null
    }
    case 'flawless_sets': {
      const good = session.setResults.filter((r) => {
        const tgt = setTargetRepsOf(r)
        return tgt > 0 && (r.actual ?? 0) >= tgt
      }).length
      return good > 0 ? { value: good, label: pl.challengeRecapContributionSets(good) } : null
    }
    case 'precision':
    case 'perfect_pair':
    case 'hat_trick': {
      const passed = trained && allSetsPassed(session.setResults)
      return passed ? { value: 1, label: pl.challengeRecapContributionPrecision } : null
    }
    case 'early_bird':
      return trained && sessionHour < 9 ? met() : null
    case 'morning_moves':
      return trained && sessionHour < 12 ? met() : null
    case 'lunch_break':
      return trained && sessionHour >= 11 && sessionHour < 14 ? met() : null
    case 'evening_shift':
      return trained && sessionHour >= 18 && sessionHour < 22 ? met() : null
    case 'night_owl':
      return trained && sessionHour >= 20 ? met() : null
    case 'around_the_clock': {
      // This session covers one half of the requirement — but only counts if
      // no earlier session already covered that half. Label names the half:
      // "Warunek spełniony!" would overclaim — the challenge needs BOTH.
      if (!trained || (sessionHour >= 9 && sessionHour < 20)) return null
      const half: 'early' | 'late' = sessionHour < 9 ? 'early' : 'late'
      const halfAlreadyCovered = weekTrained.some((s) => {
        if (s.id === session.id) return false
        const h = new Date(s.startedAt).getHours()
        return half === 'early' ? h < 9 : h >= 20
      })
      return halfAlreadyCovered
        ? null
        : { value: 1, label: pl.challengeRecapContributionClockHalf(half) }
    }
    case 'weekend':
      return trained && (sessionDay === 0 || sessionDay === 6) ? met() : null
    case 'sunday_sweat':
      return trained && sessionDay === 0 ? met() : null
    case 'weekday_quest': {
      const required = challengeRequiredWeekday(startsAt)
      const isoDay = sessionDay === 0 ? 7 : sessionDay
      return trained && isoDay === required ? met() : null
    }
    case 'dominator':
      return session.setResults.some((r) => {
        const tgt = setTargetRepsOf(r)
        return tgt > 0 && (r.actual ?? 0) >= Math.ceil(tgt * 1.5)
      })
        ? met()
        : null
    case 'strong_finish': {
      const sets = orderedSets(session)
      return sets[sets.length - 1]?.passed === true ? met() : null
    }
    case 'session_starter':
      return orderedSets(session)[0]?.passed === true ? met() : null
    case 'sharpshooter':
      return session.setResults.some(
        (r) => r.target.kind !== 'max' && setTargetRepsOf(r) > 0 && (r.actual ?? 0) === setTargetRepsOf(r),
      )
        ? met()
        : null
    case 'bounce_back': {
      let sawFail = false
      for (const r of orderedSets(session)) {
        if (!r.passed) sawFail = true
        else if (sawFail) return met()
      }
      return null
    }
    case 'metronome': {
      const actuals = session.setResults.map((r) => r.actual ?? 0)
      const ok = actuals.length >= 3 && Math.max(...actuals) - Math.min(...actuals) <= 2
      return ok ? met() : null
    }
    case 'double': {
      // This session completes the requirement only if a trained session
      // already exists on the same local day — otherwise no contribution yet.
      if (!trained) return null
      const dayKey = challengeLocalDayKey(session.startedAt)
      const priorSameDay = weekTrained.some(
        (s) => s.id !== session.id && challengeLocalDayKey(s.startedAt) === dayKey,
      )
      return priorSameDay ? met() : null
    }
    case 'max_set':
    case 'personal_best': {
      // The metric is the best single set, not reps contributed — a "+N
      // reps" label would wrongly imply volume.
      const maxSet = session.setResults.reduce((max, r) => Math.max(max, r.actual ?? 0), 0)
      return maxSet > 0 ? { value: maxSet, label: pl.challengeRecapBestSet(maxSet) } : null
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
  if (type === 'consistency' || type === 'perfect_pair' || type === 'hat_trick') {
    return pl.challengeRecapRemainingSessions(remaining)
  }
  if (type === 'daily') return pl.challengeRecapRemainingDays(remaining)
  if (type === 'grinder' || type === 'flawless_sets') return pl.challengeRecapRemainingSets(remaining)
  switch (type) {
    // Rep-delta targets — "N more reps!" reads naturally.
    case 'volume':
    case 'marathon':
    case 'max_set':
    case 'surplus':
    case 'big_day':
    case 'improvement':
      return pl.challengeRecapRemainingReps(remaining)
    // Binary condition / record-beat types — a "N left" countdown would be
    // misleading (either the condition holds or it doesn't).
    default:
      return null
  }
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
  const [allSessions, setAllSessions] = useState<LocalWorkoutSession[]>([])
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

        // Filter to this workout's program only + types this build knows
        const relevant = active.filter(
          (ch) => ch.program === program && isKnownChallengeType(ch.challenge_type),
        )
        if (relevant.length === 0) {
          setLoaded(true)
          return
        }

        setChallenges(relevant)

        // One shared session snapshot — progress calc AND per-challenge
        // contribution dedup both read from it.
        const sessions = await db.workoutSessions
          .where('status')
          .equals('completed')
          .toArray()
        setAllSessions(sessions)

        const prog = await calculateAllChallengeProgress(relevant, sessions)
        if (cancelled || !mountedRef.current) return
        setProgress(prog)
        setLoaded(true)

        // Submit now — points land at workout end instead of waiting for the
        // next dashboard card load. Fire-and-forget: display doesn't depend
        // on the submit, and the card re-submits on its next load anyway.
        const displayName = useAppStore.getState().settings.displayName ?? ''
        if (displayName.trim()) {
          void autoSubmitChallengeProgress(relevant, prog, displayName).catch(() => {})
        }
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
          'flex w-full items-center gap-2 rounded-[var(--sr-radius-md)] text-left',
          FOCUS_RING,
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
          const contribution = session
            ? sessionContribution(
                ch.challenge_type,
                session,
                ch.starts_at,
                sessionsInRange(allSessions, ch.program, ch.starts_at, ch.ends_at).filter(
                  (s) => s.setResults.length > 0,
                ),
              )
            : null
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
                    {typeTitle(ch.challenge_type)}
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
