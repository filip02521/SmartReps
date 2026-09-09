import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Card, Badge } from '@/components/ui/Card'
import { ProgramIcon } from '@/components/ui/ProgramIcon'
import { pl } from '@/i18n/pl'
import { getCycleName, getProgramLabel, getProgramGoalLabel, getProgramUnit, getProgramAccentVar } from '@/lib/plan-resolver'
import { getTargetReps } from '@/lib/progress-engine'
import { getCycleTier, selectCycleByTest, type CycleTier } from '@/lib/cycle-selector'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import type { Cycle, Program } from '@/data/plans/types'
import { CycleDetailSheet } from './CycleDetailSheet'

type TierMeta = {
  tier: CycleTier
  label: string
  desc: string
}

function tierMeta(tier: CycleTier): TierMeta {
  switch (tier) {
    case 'beginner':
      return { tier, label: pl.programTierBeginner, desc: pl.programTierBeginnerDesc }
    case 'intermediate':
      return { tier, label: pl.programTierIntermediate, desc: pl.programTierIntermediateDesc }
    case 'advanced':
      return { tier, label: pl.programTierAdvanced, desc: pl.programTierAdvancedDesc }
  }
}

const TIER_ORDER: CycleTier[] = ['beginner', 'intermediate', 'advanced']

function tierRepsRange(cycles: Cycle[]): { min: number; max: number | null } {
  const sorted = [...cycles].sort((a, b) => a.level - b.level)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  return {
    min: first.testRange.min,
    max: last.testRange.max,
  }
}

function layoutLabel(cycle: Cycle): string {
  return cycle.layout === 'standard_6day'
    ? pl.programTierLayout6day
    : cycle.layout === 'compact_3day'
      ? pl.programTierLayout3day
      : pl.programTierLayout9day
}

function peakDay(cycle: Cycle): { dayNumber: number; total: number } {
  return cycle.days.reduce(
    (best, day) => {
      const total = day.sets.reduce((s, t) => s + getTargetReps(t), 0)
      return total > best.total ? { dayNumber: day.dayNumber, total } : best
    },
    { dayNumber: cycle.days[0]?.dayNumber ?? 1, total: 0 },
  )
}

export function ProgramBrowser({
  program,
  cycles,
  programEnabled,
  hasProgress,
  currentCycleId,
  currentStatus,
  lastTestReps,
  highlightCycleId,
  onEnableProgram,
  onHighlightConsumed,
}: {
  program: Program
  cycles: Cycle[]
  programEnabled: boolean
  hasProgress: boolean
  currentCycleId: string | null
  currentStatus: string | undefined
  lastTestReps: number | null
  highlightCycleId?: string | null
  onEnableProgram: (program: Program) => void
  onHighlightConsumed?: () => void
}) {
  // Rekomendowany cykl z ostatniego testu — używa selectCycleByTest (z edge case 5 pompek)
  const recommendedCycleId = useMemo(
    () => (lastTestReps != null ? selectCycleByTest(program, lastTestReps).id : null),
    [program, lastTestReps],
  )

  const [openTier, setOpenTier] = useState<CycleTier | null>(() => {
    // Domyślnie rozwinięty tier: bieżący cykl → zalecany → początkujący
    if (currentCycleId) {
      const current = cycles.find((c) => c.id === currentCycleId)
      if (current) return getCycleTier(current)
    }
    if (recommendedCycleId) {
      const rec = cycles.find((c) => c.id === recommendedCycleId)
      if (rec) return getCycleTier(rec)
    }
    return 'beginner'
  })
  const [detailCycleId, setDetailCycleId] = useState<string | null>(null)

  // Deep-link z Dashboardu (?highlight=cycleId) → otwórz sheet i rozwiń tier
  useEffect(() => {
    if (!highlightCycleId) return
    const cycle = cycles.find((c) => c.id === highlightCycleId)
    if (!cycle) return
    setOpenTier(getCycleTier(cycle))
    setDetailCycleId(highlightCycleId)
    onHighlightConsumed?.()
  }, [highlightCycleId, cycles, onHighlightConsumed])

  const grouped = useMemo(() => {
    const map: Record<CycleTier, Cycle[]> = {
      beginner: [],
      intermediate: [],
      advanced: [],
    }
    for (const cycle of cycles) {
      map[getCycleTier(cycle)].push(cycle)
    }
    return map
  }, [cycles])

  const goalLabel = getProgramGoalLabel(program)
  const unit = getProgramUnit(program)
  const accentVar = getProgramAccentVar(program)
  const detailCycle = detailCycleId
    ? cycles.find((c) => c.id === detailCycleId) ?? null
    : null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] ring-1"
          style={{
            background: `color-mix(in srgb, ${accentVar} 15%, transparent)`,
            // @ts-expect-error — CSS custom property
            '--tw-ring-color': `color-mix(in srgb, ${accentVar} 30%, transparent)`,
          }}
          aria-hidden
        >
          <ProgramIcon program={program} size={22} />
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[var(--sr-text-primary)]">
            {getProgramLabel(program)}
          </p>
          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">{goalLabel}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {TIER_ORDER.map((tier) => {
          const meta = tierMeta(tier)
          const tierCycles = grouped[tier]
          if (tierCycles.length === 0) return null
          const range = tierRepsRange(tierCycles)
          const isOpen = openTier === tier
          const containsCurrent =
            currentCycleId != null && tierCycles.some((c) => c.id === currentCycleId)

          return (
            <TierCard
              key={tier}
              meta={meta}
              cycles={tierCycles}
              isOpen={isOpen}
              containsCurrent={containsCurrent}
              range={range}
              unit={unit}
              currentCycleId={currentCycleId}
              recommendedCycleId={recommendedCycleId}
              onToggle={() => setOpenTier(isOpen ? null : tier)}
              onOpenDetail={setDetailCycleId}
            />
          )
        })}
      </div>

      {detailCycle && (
        <CycleDetailSheet
          open
          onClose={() => setDetailCycleId(null)}
          cycle={detailCycle}
          program={program}
          programEnabled={programEnabled}
          hasProgress={hasProgress}
          currentCycleId={currentCycleId}
          currentStatus={currentStatus}
          lastTestReps={lastTestReps}
          onEnableProgram={onEnableProgram}
        />
      )}
    </section>
  )
}

function TierIcon({ tier }: { tier: CycleTier }) {
  // Trzy paski o rosnącej intensywności — wizualna metafora siły
  const accent =
    tier === 'beginner'
      ? 'var(--sr-success)'
      : tier === 'intermediate'
        ? 'var(--sr-warning)'
        : 'var(--sr-error)'
  return (
    <span
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
      style={{ background: `color-mix(in srgb, ${accent} 15%, transparent)` }}
      aria-hidden
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="14" width="3" height="6" rx="1" fill={accent} opacity="0.5" />
        <rect x="10.5" y="9" width="3" height="11" rx="1" fill={accent} opacity="0.75" />
        <rect x="17" y="4" width="3" height="16" rx="1" fill={accent} />
      </svg>
    </span>
  )
}

function TierCard({
  meta,
  cycles,
  isOpen,
  containsCurrent,
  range,
  unit,
  currentCycleId,
  recommendedCycleId,
  onToggle,
  onOpenDetail,
}: {
  meta: TierMeta
  cycles: Cycle[]
  isOpen: boolean
  containsCurrent: boolean
  range: { min: number; max: number | null }
  unit: string
  currentCycleId: string | null
  recommendedCycleId: string | null
  onToggle: () => void
  onOpenDetail: (cycleId: string) => void
}) {
  const panelId = `tier-panel-${meta.tier}`
  return (
    <Card className="p-0">
      <div className="p-4">
        <button
          type="button"
          className={cn(
            'flex min-h-12 w-full items-center justify-between gap-3 text-left transition-colors',
            FOCUS_RING,
          )}
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={onToggle}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <TierIcon tier={meta.tier} />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="block sr-text-h3 text-[var(--sr-text-primary)]">
                  {meta.label}
                </span>
                {containsCurrent && (
                  <Badge variant="success">{pl.programTierYourTier}</Badge>
                )}
              </span>
              <span className="mt-0.5 block sr-text-body-sm text-[var(--sr-text-secondary)]">
                {pl.programTierRepsRange(range.min, range.max, unit)} ·{' '}
                {pl.programTierCyclesCount(cycles.length)}
              </span>
            </span>
          </span>
          <span
            className={cn(
              'shrink-0 text-[var(--sr-text-muted)] transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          >
            <ChevronRight size={20} />
          </span>
        </button>

        {!isOpen && (
          <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)]">{meta.desc}</p>
        )}

        {isOpen && (
          <div
            id={panelId}
            className="mt-3 flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] pt-3"
          >
            {cycles.map((cycle) => (
              <CycleCard
                key={cycle.id}
                cycle={cycle}
                isCurrent={cycle.id === currentCycleId}
                isRecommended={cycle.id === recommendedCycleId}
                onOpen={() => onOpenDetail(cycle.id)}
              />
            ))}
          </div>
        )}
      </div>
    </Card>
  )
}

function CycleCard({
  cycle,
  isCurrent,
  isRecommended,
  onOpen,
}: {
  cycle: Cycle
  isCurrent: boolean
  isRecommended: boolean
  onOpen: () => void
}) {
  const peak = peakDay(cycle)
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex w-full items-start justify-between gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3 text-left transition-colors hover:border-[var(--sr-border-strong)] hover:bg-[var(--sr-bg-elevated)]',
        FOCUS_RING,
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[var(--sr-text-primary)]">
            {getCycleName(cycle)}
          </span>
          {isCurrent && <Badge variant="success">{pl.plansYourCycle}</Badge>}
          {isRecommended && !isCurrent && (
            <Badge variant="info">{pl.programRecommendedForYou}</Badge>
          )}
        </span>
        <span className="mt-1 block sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.plansDayCount(cycle.days.length)}
          {peak.total > 0 && <> · {pl.plansPeakDay(peak.dayNumber, peak.total)}</>}
        </span>
        <span className="mt-0.5 block sr-text-body-sm text-[var(--sr-text-muted)]">
          {layoutLabel(cycle)}
          {cycle.estimatedWeeks && (
            <> · {pl.planEstimatedWeeks(cycle.estimatedWeeks[0], cycle.estimatedWeeks[1])}</>
          )}
        </span>
      </span>
      <span className="mt-1 shrink-0 text-[var(--sr-text-muted)]" aria-hidden>
        <ChevronDown size={18} />
      </span>
    </button>
  )
}
