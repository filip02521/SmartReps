import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { allCycles } from '@/data/plans'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ux/Feedback'
import { formatSetTarget } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'

export default function PlansPage() {
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <h1 className="sr-text-h1">{pl.navPlans}</h1>
      <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
        SmartReps implementuje plany z{' '}
        <a href="https://100pompek.pl" className="text-[var(--sr-brand-primary)]" target="_blank" rel="noreferrer">100pompek.pl</a>
        {' '}i{' '}
        <a href="https://podciaganie.pl" className="text-[var(--sr-brand-primary)]" target="_blank" rel="noreferrer">podciaganie.pl</a>
      </p>

      {allCycles.length === 0 && (
        <div className="mt-6">
          <ErrorBanner message="Brak planów treningowych." />
        </div>
      )}

      <h2 className="mt-6 sr-text-h2" style={{ color: 'var(--sr-pushups-accent)' }}>{pl.pushupsProgram}</h2>
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
      {cycles.map((cycle) => (
        <Card key={cycle.id} className="sr-card">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left min-h-12"
            onClick={() => setOpenId(openId === cycle.id ? null : cycle.id)}
          >
            <span className="font-medium">{cycle.nameShort}</span>
            <span className="text-[var(--sr-text-muted)]">
              {openId === cycle.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </span>
          </button>
          {openId === cycle.id && (
            <div className="mt-3 space-y-3 border-t border-[var(--sr-border-subtle)] pt-3">
              {cycle.days.map((day) => (
                <div key={day.dayNumber}>
                  <p className="sr-text-body-sm font-medium">Dzień {day.dayNumber} · przerwa {day.restBetweenSetsSec}s</p>
                  <p className="sr-text-caption text-[var(--sr-text-muted)]">
                    Serie: {day.sets.map((s) => formatSetTarget(s)).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
