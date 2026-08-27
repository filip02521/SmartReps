import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { allCycles } from '@/data/plans'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBanner } from '@/components/ux/Feedback'
import { formatSetTarget } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'

export default function PlansPage() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <PageHeader
        title={pl.navPlans}
        subtitle={`SmartReps implementuje plany z 100pompek.pl i podciaganie.pl`}
      />

      {allCycles.length === 0 && (
        <div className="mt-6">
          <ErrorBanner message="Brak planów treningowych." />
        </div>
      )}

      <h2 className="mt-2 sr-text-h2" style={{ color: 'var(--sr-pushups-accent)' }}>{pl.pushupsProgram}</h2>
      <CycleList cycles={allCycles.filter((c) => c.program === 'pushups')} openId={openId} setOpenId={setOpenId} />

      <h2 className="mt-8 sr-text-h2" style={{ color: 'var(--sr-pullups-accent)' }}>{pl.pullupsProgram}</h2>
      <CycleList cycles={allCycles.filter((c) => c.program === 'pullups')} openId={openId} setOpenId={setOpenId} />

      <Card className="mt-8 sr-card">
        <h2 className="sr-text-h3">{pl.resistanceBandsTitle}</h2>
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.resistanceBandsIntro}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 sr-text-body-sm text-[var(--sr-text-secondary)]">
          <li>{pl.resistanceBandsTip1}</li>
          <li>{pl.resistanceBandsTip2}</li>
          <li>{pl.resistanceBandsTip3}</li>
        </ul>
        <p className="mt-3 sr-text-caption text-[var(--sr-text-muted)]">{pl.resistanceBandsNote}</p>
      </Card>
    </div>
  )
}

function CycleList({
  cycles,
  openId,
  setOpenId,
}: {
  cycles: typeof allCycles
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {cycles.map((cycle) => {
        const open = openId === cycle.id
        const panelId = `cycle-panel-${cycle.id}`
        return (
          <Card key={cycle.id} className="sr-card">
            <button
              type="button"
              className="flex min-h-12 w-full items-center justify-between text-left"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpenId(open ? null : cycle.id)}
            >
              <span className="font-medium">{cycle.nameShort}</span>
              <span className="text-[var(--sr-text-muted)]">
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            </button>
            {open && (
              <div id={panelId} className="mt-3 space-y-3 border-t border-[var(--sr-border-subtle)] pt-3">
                {cycle.days.map((day) => (
                  <div key={day.dayNumber}>
                    <p className="sr-text-body-sm font-medium">
                      Dzień {day.dayNumber} · {pl.restBetweenSets(day.restBetweenSetsSec)}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {day.sets.map((s, i) => (
                        <li key={i} className="flex justify-between sr-text-caption text-[var(--sr-text-muted)]">
                          <span>{pl.setColumn} {i + 1}</span>
                          <span>{formatSetTarget(s)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}
