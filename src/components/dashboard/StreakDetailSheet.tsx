import { useMemo } from 'react'
import { Flame, TrendingUp, Trophy, Calendar, AlertTriangle, Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { StreakHeatmap } from '@/components/progress/StreakHeatmap'
import { pl } from '@/i18n/pl'
import { computeStreakWeeks, getWeekKey } from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import type { LocalWorkoutSession } from '@/lib/db'
import { cn } from '@/lib/utils'

const MILESTONES = [4, 8, 12, 26, 52]

function nextMilestone(current: number): number | null {
  for (const m of MILESTONES) {
    if (current < m) return m
  }
  return null
}

function milestoneReached(current: number): number[] {
  return MILESTONES.filter((m) => current >= m)
}

/** Stat card — compact metric with label. */
function StatCard({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: typeof Flame
  value: string | number
  label: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-1 rounded-[var(--sr-radius-md)] border p-3',
        accent
          ? 'border-[color-mix(in_srgb,var(--sr-brand-primary)_30%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,var(--sr-bg-surface))]'
          : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
      )}
    >
      <Icon
        size={18}
        className={accent ? 'text-[var(--sr-brand-primary)]' : 'text-[var(--sr-text-muted)]'}
        aria-hidden
      />
      <span className="text-2xl font-bold tabular-nums leading-none text-[var(--sr-text-primary)]">
        {value}
      </span>
      <span className="sr-text-caption text-center text-[var(--sr-text-secondary)]">{label}</span>
    </div>
  )
}

/** Milestone pill — shows reached vs upcoming milestones. */
function MilestoneRow({ current }: { current: number }) {
  const reached = milestoneReached(current)
  const next = nextMilestone(current)
  const weeksToNext = next ? next - current : 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {MILESTONES.map((m) => {
          const done = reached.includes(m)
          return (
            <span
              key={m}
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--sr-radius-full)] px-2.5 py-1 text-xs font-semibold tabular-nums',
                done
                  ? 'bg-[var(--sr-brand-primary)] text-white'
                  : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)] border border-[var(--sr-border-subtle)]',
              )}
            >
              {done && <Trophy size={11} aria-hidden />}
              {m} {pl.streakSheetWeeksShort}
            </span>
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
  const streak = useMemo(() => computeStreakWeeks(completed), [completed])
  const bestStreak = useMemo(() => computeBestStreakWeeks(completed), [completed])
  const totalSessions = completed.length
  const isNewRecord = streak > 0 && streak >= bestStreak && bestStreak > 0
  const isLegendary = streak >= 26
  const isHot = streak >= 12

  // Detect current-week status: at-risk (streak > 0 but no session this week)
  const currentWeekKey = getWeekKey(new Date())
  const currentWeekHasSessions = completed.some(
    (s) => getWeekKey(new Date(s.startedAt)) === currentWeekKey,
  )
  const isAtRisk = streak > 0 && !currentWeekHasSessions
  const isEmpty = totalSessions === 0

  return (
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
              {MILESTONES.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1 rounded-[var(--sr-radius-full)] bg-[var(--sr-bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--sr-text-muted)] border border-[var(--sr-border-subtle)]"
                >
                  <Trophy size={11} aria-hidden />
                  {m} {pl.streakSheetWeeksShort}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* At-risk warning banner */}
            {isAtRisk && (
              <div className="flex items-center gap-3 rounded-[var(--sr-radius-md)] border border-[color-mix(in_srgb,var(--sr-warning)_35%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_8%,var(--sr-bg-surface))] p-3">
                <AlertTriangle
                  size={20}
                  className="shrink-0 text-[var(--sr-warning)]"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="sr-text-body-sm font-semibold text-[var(--sr-warning)]">
                    {pl.streakSheetAtRiskTitle}
                  </p>
                  <p className="mt-0.5 sr-text-caption text-[var(--sr-text-secondary)]">
                    {pl.streakSheetAtRiskHint}
                  </p>
                </div>
              </div>
            )}

            {/* Hero — current streak number, tiered intensity */}
            <div
              className={cn(
                'flex items-center gap-4 rounded-[var(--sr-radius-lg)] border p-4',
                isLegendary
                  ? 'border-[color-mix(in_srgb,var(--sr-warning)_30%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-warning)_8%,var(--sr-bg-surface))]'
                  : isHot
                    ? 'border-[color-mix(in_srgb,var(--sr-brand-primary)_30%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_8%,var(--sr-bg-surface))]'
                    : streak > 0
                      ? 'border-[color-mix(in_srgb,var(--sr-brand-primary)_25%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_6%,var(--sr-bg-surface))]'
                      : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
              )}
            >
              <div
                className={cn(
                  'flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
                  isLegendary
                    ? 'bg-[color-mix(in_srgb,var(--sr-warning)_18%,transparent)] text-[var(--sr-warning)]'
                    : streak > 0
                      ? 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_15%,transparent)] text-[var(--sr-brand-primary)]'
                      : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
                )}
                aria-hidden
              >
                <Flame
                  size={isLegendary ? 32 : 28}
                  strokeWidth={2.25}
                  className={cn(streak > 0 && 'sr-flame-pulse')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      'font-bold tabular-nums leading-none',
                      isLegendary ? 'text-[var(--sr-warning)]' : 'text-[var(--sr-text-primary)]',
                    )}
                    style={{ fontSize: isLegendary ? '2.75rem' : '2.5rem' }}
                  >
                    {streak}
                  </span>
                  <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                    {pl.streakChainWeeks(streak)}
                  </span>
                </div>
                {isNewRecord ? (
                  <span className="mt-1.5 inline-block rounded-[var(--sr-radius-full)] bg-[var(--sr-success-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--sr-success)]">
                    {pl.streakChainNewRecord}
                  </span>
                ) : bestStreak > 0 ? (
                  <p className="mt-1 sr-text-caption text-[var(--sr-text-muted)]">
                    {pl.streakChainBest(bestStreak)}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                icon={Flame}
                value={streak}
                label={pl.streakSheetCurrent}
                accent={streak > 0}
              />
              <StatCard icon={TrendingUp} value={bestStreak} label={pl.streakSheetBest} />
              <StatCard icon={Calendar} value={totalSessions} label={pl.streakSheetTotal} />
            </div>

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
      </div>
    </Sheet>
  )
}
