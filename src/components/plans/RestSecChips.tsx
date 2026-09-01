import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'

const PRESETS = [60, 90, 120] as const

function isPresetValue(value: number): value is (typeof PRESETS)[number] {
  return PRESETS.includes(value as (typeof PRESETS)[number])
}

export function RestSecChips({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (sec: number) => void
}) {
  const [customOpen, setCustomOpen] = useState(!isPresetValue(value) && value > 0)

  useEffect(() => {
    setCustomOpen(!isPresetValue(value) && value > 0)
  }, [value])

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((sec) => (
          <button
            key={sec}
            type="button"
            className={cn(
              'min-h-11 rounded-[var(--sr-radius-sm)] border px-3 text-sm font-medium',
              FOCUS_RING,
              value === sec && !customOpen
                ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-text-primary)]'
                : 'border-[var(--sr-border-subtle)] text-[var(--sr-text-secondary)]',
            )}
            onClick={() => {
              setCustomOpen(false)
              onChange(sec)
            }}
          >
            {sec}s
          </button>
        ))}
        <button
          type="button"
          className={cn(
            'min-h-11 rounded-[var(--sr-radius-sm)] border px-3 text-sm font-medium',
            FOCUS_RING,
            customOpen
              ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-text-primary)]'
              : 'border-[var(--sr-border-subtle)] text-[var(--sr-text-secondary)]',
          )}
          onClick={() => setCustomOpen(true)}
        >
          {pl.planRestChipCustom}
        </button>
      </div>
      {customOpen && (
        <TextField
          id={id}
          className="mt-2"
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
      )}
    </div>
  )
}

export function SetsCountStepper({
  value,
  onChange,
  min = 1,
  max = 30,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">{pl.planSetsCount}</p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 min-w-11"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          −
        </Button>
        <span className="min-w-[2rem] text-center text-lg font-semibold tabular-nums">{value}</span>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 min-w-11"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
        >
          +
        </Button>
      </div>
    </div>
  )
}
