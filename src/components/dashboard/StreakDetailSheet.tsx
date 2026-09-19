import { useMemo, useState } from 'react'
import { Trophy, AlertTriangle, Sparkles, Snowflake, Lock } from 'lucide-react'
import { StreakFlame, streakFlameColor, streakFlameTier } from '@/components/dashboard/StreakFlame'
import { Sheet } from '@/components/ui/Sheet'
import { NestedStat } from '@/components/ui/NestedStat'
import { StatusPill } from '@/components/ui/StatusPill'
import { StreakHeatmap } from '@/components/progress/StreakHeatmap'
import { ProTeaser } from '@/components/ux/ProTeaser'
import { pl } from '@/i18n/pl'
import {
  computeStreakWeeks,
  daysLeftInStreakWeek,
  getWeekKey,
  STREAK_MILESTONES,
  nextStreakMilestone,
  reachedStreakMilestones,
} from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import { useFrozenWeeks, useFreezeBalance } from '@/lib/streak-freeze'
import { useProFeatures } from '@/lib/subscription'
import type { LocalWorkoutSession } from '@/lib/db'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'



/** Milestone pill — shows reached vs upcoming milestones. */
function MilestoneRow({ current }: { current: number }) {
  const reached = reachedStreakMilestones(current)
  const next = nextStreakMilestone(current)
  const weeksToNext = next ? next - current : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {STREAK_MILESTONES.map((m) => {
          const done = reached.includes(m)
          return (
            <StatusPill
              key={m}
              tone={done ? 'brand-solid' : 'outline'}
              size="md"
              icon={done ? <Trophy size={11} aria-hidden /> : undefined}
              className="tabular-nums"
            >
              {m} {pl.streakSheetWeeksShort}
            </StatusPill>
          )
        })}
      </div>
      {next && (
        <p className="sr-text-caption text-[var(--sr-text-secondary)]">
          {pl.streakSheetMilestoneProgress(weeksToNext, next)}
        </p>
      )}
      {!next && (
        <p className="sr-text-caption font-medium text-[var(--sr-brand-primary)]">
          {pl.streakSheetAllMilestones}
        </p>
      )}
    </div>
  )
}

export function StreakDetailSheet({
  open,
  onClose,
  sessions,
}: {
  open: boolean
  onClose: () => void
  sessions: LocalWorkoutSession[]
}) {
  const completed = useMemo(
    () => sessions.filter((s) => s.status === 'completed'),
    [sessions],
  )
  const frozenWeeks = useFrozenWeeks()
  const freezeBalance = useFreezeBalance()
  const pro = useProFeatures()
  const [freezeTeaserOpen, setFreezeTeaserOpen] = useState(false)
  const streak = useMemo(
    () => computeStreakWeeks(completed, new Date(), frozenWeeks),
    [completed, frozenWeeks],
  )
  const bestStreak = useMemo(
    () => computeBestStreakWeeks(completed, frozenWeeks),
    [completed, frozenWeeks],
  )
  const totalSessions = completed.length
  const isNewRecord = streak > 0 && streak >= bestStreak && bestStreak > 0
  const flameTier = streakFlameTier(streak)
  const isLegendary = flameTier >= 5
  const isHot = flameTier >= 4

  // Detect current-week status: at-risk (streak > 0 but no session this week)
  const currentWeekKey = getWeekKey(new Date())
  const currentWeekHasSessions = completed.some(
    (s) => getWeekKey(new Date(s.startedAt)) === currentWeekKey,
  )
  const isAtRisk = streak > 0 && !currentWeekHasSessions
  const isEmpty = totalSessions === 0

  return (
    <>
    <Sheet open={open} onClose={onClose} title={pl.streakSheetTitle} className="max-w-md">
      <div className="flex flex-col gap-5 pb-4">
        {/* Empty state — motivational, not demotivating */}
        {isEmpty ? (
          <div className="flex flex-col items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[color-mix(in_srgb,var(--sr-brand-primary)_20%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_4%,var(--sr-bg-surface))] p-6 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sr-brand-primary)_12%,transparent)] text-[var(--sr-brand-primary)]"
              aria-hidden
            >
              <Sparkles size={28} />
            </div>
            <div>
              <p className="sr-text-body font-semibold text-[var(--sr-text-primary)]">
                {pl.streakSheetEmptyTitle}
              </p>
              <p className="mt-1.5 sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.streakSheetEmptyHint}
              </p>
            </div>
            {/* Milestone preview — show what's achievable */}
            <div className="mt-1 flex flex-wrap justify-center gap-1.5">
              {STREAK_MILESTONES.map((m) => (
                <StatusPill
                  key={m}
                  tone="outline"
                  size="md"
                  icon={<Trophy size={11} aria-hidden />}
                >
                  {m} {pl.streakSheetWeeksShort}
                </StatusPill>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* At-risk warning banner — countdown + explicit loss statement.
                Pro users with freezes get a reassurance line instead of pure
                urgency (the freeze may bridge the week automatically). */}
            {isAtRisk && (
              <div className="sr-risk-pulse flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[color-mix(in_srgb,var(--sr-warning)_35%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_8%,var(--sr-bg-surface))] p-3">
                <AlertTriangle
                  size={20}
                  className="shrink-0 text-[var(--sr-warning)]"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="sr-text-body-sm font-semibold text-[var(--sr-warning)]">
                    {pl.streakSheetAtRiskTitle}
                    {' · '}
                    {pl.streakAtRiskDaysLeft(daysLeftInStreakWeek())}
                  </p>
                  <p className="mt-0.5 sr-text-caption font-medium text-[var(--sr-text-secondary)]">
                    {pl.streakAtRiskLoss(streak)}
                  </p>
                  {pro && freezeBalance.available > 0 && (
                    <p className="mt-0.5 sr-text-caption text-[var(--sr-info)]">
                      {pl.streakAtRiskFreezeNote}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Hero — current streak number, tiered intensity */}
            <div
              className={cn(
                'flex items-center gap-4 rounded-[var(--sr-radius-lg)] border p-4',
                streak === 0 && 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
              )}
              style={
                streak > 0
                  ? {
                      borderColor: `color-mix(in srgb, ${streakFlameColor(streak)} ${isHot ? 30 : 25}%, var(--sr-border-subtle))`,
                      backgroundColor: `color-mix(in srgb, ${streakFlameColor(streak)} ${isHot ? 8 : 6}%, var(--sr-bg-surface))`,
                    }
                  : undefined
              }
            >
              <div
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
                  streak === 0 && 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
                )}
                style={
                  streak > 0
                    ? {
                        backgroundColor: `color-mix(in srgb, ${streakFlameColor(streak)} 18%, transparent)`,
                        color: streakFlameColor(streak),
                      }
                    : undefined
                }
                aria-hidden
              >
                <StreakFlame
                  streak={streak}
                  size={isLegendary ? 32 : 28}
                  strokeWidth={2.25}
                  sparkle
                  embers
                  burst
                  dying={isAtRisk}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'font-bold tabular-nums leading-none',
                      flameTier < 4 && 'text-[var(--sr-text-primary)]',
                    )}
                    style={{
                      fontSize: isLegendary ? '2.75rem' : '2.5rem',
                      color: flameTier >= 4 ? streakFlameColor(streak) : undefined,
                    }}
                  >
                    {streak}
                  </span>
                  <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                    {pl.streakChainWeeks(streak)}
                  </span>
                </div>
                {isNewRecord && !isAtRisk ? (
                  <StatusPill tone="success" className="mt-1.5">
                    {pl.streakChainNewRecord}
                  </StatusPill>
                ) : bestStreak > 0 ? (
                  <p className="mt-1 sr-text-caption text-[var(--sr-text-muted)]">
                    {pl.streakChainBest(bestStreak)}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Stats — the hero already shows current + best streak, so only
                the metric that isn't duplicated stays: total sessions. */}
            <NestedStat size="md" overline={pl.streakSheetTotal} value={totalSessions} />

            {/* Heatmap — full 12-week view */}
            <div>
              <p className="mb-2 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                {pl.streakHeatmapTitle}
              </p>
              <StreakHeatmap sessions={sessions} showHeader={false} />
            </div>

            {/* Milestones */}
            <div>
              <p className="mb-2 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
                {pl.streakSheetMilestones}
              </p>
              <MilestoneRow current={streak} />
            </div>
          </>
        )}

        {/* Streak freeze — Pro perk; free users see a teaser row */}
        {pro ? (
          <div className="flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[color-mix(in_srgb,var(--sr-info)_30%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-info)_7%,var(--sr-bg-surface))] p-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-info-muted)] text-[var(--sr-info)]"
              aria-hidden
            >
              <Snowflake size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
                {pl.streakFreezeTitle}
              </p>
              <p className="mt-0.5 sr-text-caption font-medium text-[var(--sr-info)]">
                {freezeBalance.available > 0
                  ? pl.streakFreezeAvailable(freezeBalance.available)
                  : pl.streakFreezeAvailableNone}
              </p>
              <p className="mt-0.5 sr-text-caption text-[var(--sr-text-secondary)]">
                {pl.streakFreezeHowItWorks}
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setFreezeTeaserOpen(true)}
            className={cn(
              FOCUS_RING,
              'flex w-full items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3 text-left transition-colors hover:bg-[var(--sr-bg-elevated)]',
            )}
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]"
              aria-hidden
            >
              <Snowflake size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="sr-text-body-sm font-semibold text-[var(--sr-text-primary)]">
                {pl.streakFreezeTitle}
              </p>
              <p className="mt-0.5 sr-text-caption text-[var(--sr-text-secondary)]">
                {pl.streakFreezeFreeHint}
              </p>
            </div>
            <Lock size={16} aria-hidden className="shrink-0 text-[var(--sr-text-muted)]" />
          </button>
        )}
      </div>
    </Sheet>
    <ProTeaser
      open={freezeTeaserOpen}
      onClose={() => setFreezeTeaserOpen(false)}
      feature="streakFreeze"
    />
    </>
  )
}
