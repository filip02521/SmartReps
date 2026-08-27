import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { allCycles } from '@/data/plans'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSection } from '@/components/ui/PageSection'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { NestedStat } from '@/components/ui/NestedStat'
import { EmptyState } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { formatSetTarget } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

export default function PlansPage() {
  const [openId, setOpenId] = useState<string | null>(null)
  const pushups = allCycles.filter((c) => c.program === 'pushups')
  const pullups = allCycles.filter((c) => c.program === 'pullups')

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <PageHeader title={pl.navPlans} subtitle={pl.plansCatalogHint} />

      {allCycles.length === 0 ? (
        <EmptyState icon={<LogoMark size={48} />} title={pl.noPlans} />
      ) : (
        <>
          <PageSection title={pl.pushupsProgram} hint={pl.plansProgramHint} className="mt-2">
            <CycleList
              program="pushups"
              cycles={pushups}
              openId={openId}
              setOpenId={setOpenId}
            />
          </PageSection>

          <PageSection title={pl.pullupsProgram} hint={pl.plansProgramHint}>
            <CycleList
              program="pullups"
              cycles={pullups}
              openId={openId}
              setOpenId={setOpenId}
            />
          </PageSection>

          <PageSection title={pl.resistanceBandsTitle} hint={pl.resistanceBandsIntro}>
            <ul className="list-disc space-y-2 pl-5 sr-text-body-sm text-[var(--sr-text-secondary)]">
              <li>{pl.resistanceBandsTip1}</li>
              <li>{pl.resistanceBandsTip2}</li>
              <li>{pl.resistanceBandsTip3}</li>
            </ul>
            <p className="mt-3 sr-text-caption text-[var(--sr-text-muted)]">
              {pl.resistanceBandsNote}
            </p>
          </PageSection>
        </>
      )}
    </div>
  )
}

function CycleList({
  program,
  cycles,
  openId,
  setOpenId,
}: {
  program: Program
  cycles: typeof allCycles
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {cycles.map((cycle) => {
        const open = openId === cycle.id
        const panelId = `cycle-panel-${cycle.id}`
        return (
          <ProgramAccentCard key={cycle.id} program={program} className="p-4">
            <button
              type="button"
              className={cn(
                'flex min-h-12 w-full items-center justify-between text-left',
                FOCUS_RING,
              )}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : cycle.id)}
            >
              <span>
                <span className="block font-semibold text-[var(--sr-text-primary)]">
                  {cycle.nameShort}
                </span>
                <span className="sr-text-caption text-[var(--sr-text-muted)]">
                  {pl.plansDayCount(cycle.days.length)}
                </span>
              </span>
              <span className="text-[var(--sr-text-muted)]">
                {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </span>
            </button>
            {open && (
              <div
                id={panelId}
                className="mt-3 space-y-2 border-t border-[var(--sr-border-subtle)] pt-3"
              >
                {cycle.days.map((day) => (
                  <NestedStat
                    key={day.dayNumber}
                    overline={`${pl.dayLabel(day.dayNumber)} · ${pl.restBetweenSets(day.restBetweenSetsSec)}`}
                    value={day.sets.map((s, i) => `${i + 1}: ${formatSetTarget(s)}`).join(' · ')}
                  />
                ))}
              </div>
            )}
          </ProgramAccentCard>
        )
      })}
    </div>
  )
}
