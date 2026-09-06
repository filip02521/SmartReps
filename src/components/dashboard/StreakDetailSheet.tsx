import { useMemo } from 'react'
import { Flame, TrendingUp, Trophy, Calendar } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { StreakHeatmap } from '@/components/progress/StreakHeatmap'
import { pl } from '@/i18n/pl'
import { computeStreakWeeks } from '@/lib/stats-engine'
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

  return (
    <Sheet open={open} onClose={onClose} title={pl.streakSheetTitle} className="max-w-md">
      <div className="flex flex-col gap-5 pb-4">
        {/* Hero — current streak number */}
        <div
          className={cn(
            'flex items-center gap-4 rounded-[var(--sr-radius-lg)] border p-4',
            streak > 0
              ? 'border-[color-mix(in_srgb,var(--sr-brand-primary)_25%,var(--sr-border-subtle))] bg-[color-mix(in_srgb,var(--sr-brand-primary)_6%,var(--sr-bg-surface))]'
              : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
          )}
        >
          <div
            className={cn(
              'flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
              streak > 0
                ? 'bg-[color-mix(in_srgb,var(--sr-brand-primary)_15%,transparent)] text-[var(--sr-brand-primary)]'
                : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
            )}
            aria-hidden
          >
            <Flame size={28} strokeWidth={2.25} className={cn(streak > 0 && 'sr-flame-pulse')} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums leading-none text-[var(--sr-text-primary)]">
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
      </div>
    </Sheet>
  )
}
