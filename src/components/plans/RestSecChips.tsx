import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { NumericDraftInput } from '@/components/ui/NumericDraftInput'
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
  disabled = false,
  hideLabel = false,
  size = 'default',
  nowrap = false,
  trailing,
}: {
  id: string
  label: string
  value: number
  onChange: (sec: number) => void
  disabled?: boolean
  /** When label is rendered by a parent row (e.g. workout header). */
  hideLabel?: boolean
  size?: 'default' | 'compact'
  /** Keep chips on one line (horizontal scroll if needed). */
  nowrap?: boolean
  /** Right-side control aligned with the chip row (e.g. set stepper). */
  trailing?: ReactNode
}) {
  const [customOpen, setCustomOpen] = useState(!isPresetValue(value) && value > 0)
  const compact = size === 'compact'

  useEffect(() => {
    setCustomOpen(!isPresetValue(value) && value > 0)
  }, [value])

  const chipClass = (active: boolean) =>
    cn(
      'rounded-[var(--sr-radius-sm)] border font-medium transition-colors active:scale-95',
      FOCUS_RING,
      compact ? 'min-h-9 shrink-0 px-2.5 text-xs' : 'min-h-11 px-3 text-sm',
      active
        ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-text-primary)]'
        : 'border-[var(--sr-border-subtle)] text-[var(--sr-text-secondary)] hover:border-[var(--sr-border-strong)] hover:text-[var(--sr-text-primary)]',
    )

  return (
    <div className={cn(disabled && 'pointer-events-none opacity-60')}>
      {!hideLabel && (
        <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">{label}</p>
      )}
      <div className={cn('flex items-center gap-2', trailing && 'gap-3')}>
        <div
          className={cn(
            'min-w-0',
            trailing ? 'flex-1' : undefined,
            nowrap
              ? 'flex flex-nowrap gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
              : cn('flex flex-wrap', compact ? 'gap-1.5' : 'gap-2'),
          )}
        >
          {PRESETS.map((sec) => (
            <button
              key={sec}
              type="button"
              className={chipClass(value === sec && !customOpen)}
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
            className={chipClass(customOpen)}
            onClick={() => setCustomOpen(true)}
          >
            {pl.planRestChipCustom}
          </button>
        </div>
        {trailing}
      </div>
      {customOpen && (
        <NumericDraftInput
          id={id}
          className="mt-2"
          ariaLabel={label}
          mode="integer"
          min={0}
          value={value}
          disabled={disabled}
          onCommit={onChange}
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
  disabled = false,
}: {
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
  disabled?: boolean
}) {
  return (
    <div className={cn(disabled && 'pointer-events-none opacity-60')}>
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
