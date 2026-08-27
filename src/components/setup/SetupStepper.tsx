import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'

const STEPS = [
  { id: 'test', label: pl.setupStepTest },
  { id: 'cycle', label: pl.setupStepCycle },
  { id: 'start', label: pl.setupStepStart },
  { id: 'login', label: pl.setupStepLogin },
] as const

export type SetupStepId = (typeof STEPS)[number]['id']

export function SetupStepper({ current }: { current: SetupStepId }) {
  const idx = STEPS.findIndex((s) => s.id === current)

  return (
    <nav aria-label={pl.setupProgress} className="mb-6">
      <ol className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const done = i < idx
          const active = i === idx
          return (
            <li key={step.id} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'h-1.5 w-full rounded-full',
                  done || active ? 'bg-[var(--sr-brand-primary)]' : 'bg-[var(--sr-bg-surface)]',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'sr-text-overline text-center normal-case tracking-normal',
                  active ? 'font-semibold text-[var(--sr-text-primary)]' : 'text-[var(--sr-text-muted)]',
                )}
              >
                {step.label}
                {active && <span className="sr-only"> ({pl.setupStepCurrent})</span>}
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
