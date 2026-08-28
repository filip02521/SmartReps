import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { allCycles } from '@/data/plans'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageSection } from '@/components/ui/PageSection'
import { ProgramAccentCard } from '@/components/ui/ProgramAccentCard'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { Badge } from '@/components/ui/Card'
import { EmptyState } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import { getTargetReps } from '@/lib/progress-engine'
import { db } from '@/lib/db'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'
import type { LocalProgramProgress } from '@/lib/db'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

export default function PlansPage() {
  const [searchParams] = useSearchParams()
  const highlightId = searchParams.get('highlight')
  const [openId, setOpenId] = useState<string | null>(null)
  const [progressByProgram, setProgressByProgram] = useState<
    Partial<Record<Program, LocalProgramProgress>>
  >({})
  const highlightRef = useRef<HTMLDivElement | null>(null)
  const pushups = allCycles.filter((c) => c.program === 'pushups')
  const pullups = allCycles.filter((c) => c.program === 'pullups')

  useEffect(() => {
    void (async () => {
      const rows = await db.programProgress.toArray()
      const map: Partial<Record<Program, LocalProgramProgress>> = {}
      for (const row of rows) {
        map[row.program] = row
      }
      setProgressByProgram(map)
    })()
  }, [])

  useEffect(() => {
    if (!highlightId) return
    setOpenId(highlightId)
    const t = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    return () => window.clearTimeout(t)
  }, [highlightId, progressByProgram])

  const currentCycleIds = new Set(
    Object.values(progressByProgram)
      .map((p) => p?.cycleId)
      .filter(Boolean) as string[],
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
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
              highlightId={highlightId}
              highlightRef={highlightRef}
              currentCycleIds={currentCycleIds}
            />
          </PageSection>

          <PageSection title={pl.pullupsProgram} hint={pl.plansProgramHint}>
            <CycleList
              program="pullups"
              cycles={pullups}
              openId={openId}
              setOpenId={setOpenId}
              highlightId={highlightId}
              highlightRef={highlightRef}
              currentCycleIds={currentCycleIds}
            />
          </PageSection>

          <PageSection title={pl.resistanceBandsTitle} hint={pl.resistanceBandsIntro}>
            <ul className="list-disc space-y-2 pl-5 sr-text-body-sm text-[var(--sr-text-secondary)]">
              <li>{pl.resistanceBandsTip1}</li>
              <li>{pl.resistanceBandsTip2}</li>
              <li>{pl.resistanceBandsTip3}</li>
            </ul>
            <p className="mt-3 sr-text-body-sm text-[var(--sr-text-muted)]">
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
  highlightId,
  highlightRef,
  currentCycleIds,
}: {
  program: Program
  cycles: typeof allCycles
  openId: string | null
  setOpenId: (id: string | null) => void
  highlightId: string | null
  highlightRef: React.RefObject<HTMLDivElement | null>
  currentCycleIds: Set<string>
}) {
  return (
    <div className="flex flex-col gap-3">
      {cycles.map((cycle) => {
        const open = openId === cycle.id
        const panelId = `cycle-panel-${cycle.id}`
        const isCurrent = currentCycleIds.has(cycle.id)
        const isHighlighted = highlightId === cycle.id
        const peakDay = cycle.days.reduce((best, day) => {
          const total = day.sets.reduce((s, t) => s + getTargetReps(t), 0)
          return total > best.total ? { total, day } : best
        }, { total: 0, day: cycle.days[0] })

        return (
          <div key={cycle.id} ref={isHighlighted ? highlightRef : undefined}>
          <ProgramAccentCard
            program={program}
            className={cn('p-4', isHighlighted && 'ring-2 ring-[var(--sr-brand-primary)]')}
          >
            <button
              type="button"
              className={cn(
                'flex min-h-12 w-full items-center justify-between gap-3 text-left',
                FOCUS_RING,
              )}
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : cycle.id)}
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="block sr-text-h3 text-[var(--sr-text-primary)]">
                    {cycle.nameShort}
                  </span>
                  {isCurrent && <Badge variant="success">{pl.plansYourCycle}</Badge>}
                </span>
                <span className="mt-0.5 block sr-text-body-sm text-[var(--sr-text-secondary)]">
                  {pl.plansDayCount(cycle.days.length)}
                  {peakDay.total > 0 && (
                    <>
                      {' · '}
                      {pl.plansPeakDay(peakDay.day.dayNumber, peakDay.total)}
                    </>
                  )}
                </span>
              </span>
              <span className="shrink-0 text-[var(--sr-text-muted)]">
                {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
              </span>
            </button>
            {open && (
              <div
                id={panelId}
                className="mt-4 space-y-4 border-t border-[var(--sr-border-subtle)] pt-4"
              >
                {cycle.days.map((day) => {
                  const dayTotal = day.sets.reduce((s, t) => s + getTargetReps(t), 0)
                  return (
                    <div key={day.dayNumber}>
                      <div className="mb-2 flex items-baseline justify-between gap-2">
                        <p className="font-semibold text-[var(--sr-text-primary)]">
                          {pl.dayLabel(day.dayNumber)}
                        </p>
                        <p className="sr-text-body-sm tabular-nums text-[var(--sr-text-secondary)]">
                          {pl.plansDayReps(day.sets.length, dayTotal)}
                        </p>
                      </div>
                      <SetTargetsRow sets={day.sets} size="md" />
                      <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)]">
                        {pl.restBetweenSets(day.restBetweenSetsSec)}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </ProgramAccentCard>
          </div>
        )
      })}
    </div>
  )
}
