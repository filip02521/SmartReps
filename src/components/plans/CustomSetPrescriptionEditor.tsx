import { TargetKindChips } from '@/components/plans/TargetKindChips'
import { NumericDraftInput } from '@/components/ui/NumericDraftInput'
import type { MetricTarget, PrimaryMetric, SetPrescription } from '@/lib/exercise-model'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import { secToDisplay, displayToSec, type DurationUnit } from '@/lib/custom-prescription-format'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

function withMetricValue(target: MetricTarget, value: number): MetricTarget {
  if (target.kind === 'max') return { kind: 'max', minValue: value }
  return { kind: target.kind, value }
}

function PrescriptionMetricBlock({
  idPrefix,
  label,
  target,
  allowKinds,
  disabled,
  mode,
  onChange,
}: {
  idPrefix: string
  label: string
  target: MetricTarget
  allowKinds?: Array<MetricTarget['kind']>
  disabled?: boolean
  mode: 'integer' | 'decimal'
  onChange: (next: MetricTarget) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
        {label}
      </p>
      <TargetKindChips
        target={target}
        allowKinds={allowKinds}
        disabled={disabled}
        size="compact"
        onChange={onChange}
      />
      <NumericDraftInput
        id={`${idPrefix}-value`}
        ariaLabel={label}
        disabled={disabled}
        mode={mode}
        value={metricTargetDisplayValue(target)}
        min={0}
        onCommit={(v) => onChange(withMetricValue(target, v))}
      />
    </div>
  )
}

export function CustomSetPrescriptionEditor({
  setNumber,
  metric,
  prescription,
  disabled = false,
  durationUnit = 'sec',
  onChange,
}: {
  setNumber: number
  metric: PrimaryMetric
  prescription: SetPrescription
  disabled?: boolean
  durationUnit?: DurationUnit
  onChange: (next: SetPrescription) => void
}) {
  const isMinUnit = metric === 'duration_sec' && durationUnit === 'min'
  const primaryTarget =
    metric === 'duration_sec'
      ? (prescription.durationSec ?? { kind: 'min', value: isMinUnit ? 300 : 30 })
      : (prescription.reps ?? { kind: 'fixed', value: 8 })
  const weightTarget = prescription.weightKg ?? { kind: 'fixed' as const, value: 20 }

  const primaryLabel =
    metric === 'duration_sec'
      ? isMinUnit
        ? pl.customWorkoutDurationMin
        : pl.customWorkoutDurationSec
      : metric === 'reps_weight'
        ? pl.customSetRepsLabel
        : pl.planTargetValue

  // For min unit, convert the stored seconds to display minutes for the input
  const displayTarget: MetricTarget = isMinUnit
    ? {
        kind: primaryTarget.kind,
        value: primaryTarget.kind === 'max' ? secToDisplay(primaryTarget.minValue, 'min') : secToDisplay(primaryTarget.value, 'min'),
        ...(primaryTarget.kind === 'max' ? { minValue: secToDisplay(primaryTarget.minValue, 'min') } : {}),
      } as MetricTarget
    : primaryTarget

  return (
    <article className="overflow-hidden rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]">
      <header className="border-b border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-3 py-2">
        <p className="text-sm font-semibold text-[var(--sr-text-primary)]">
          {pl.customSetEditorTitle(setNumber)}
        </p>
      </header>

      <div
        className={cn(
          'grid gap-4 p-3',
          metric === 'reps_weight' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1',
        )}
      >
        <PrescriptionMetricBlock
          idPrefix={`set-${setNumber}-primary`}
          label={primaryLabel}
          target={displayTarget}
          mode="integer"
          disabled={disabled}
          onChange={(next) => {
            if (metric === 'duration_sec') {
              // Convert display value back to seconds
              const secValue = next.kind === 'max' ? displayToSec(next.minValue, durationUnit) : displayToSec(next.value, durationUnit)
              const secTarget: MetricTarget = next.kind === 'max'
                ? { kind: 'max', minValue: secValue }
                : { kind: next.kind, value: secValue }
              onChange({ durationSec: secTarget })
            } else {
              onChange({ reps: next, weightKg: prescription.weightKg })
            }
          }}
        />

        {metric === 'reps_weight' && (
          <PrescriptionMetricBlock
            idPrefix={`set-${setNumber}-weight`}
            label={pl.customWorkoutWeightKg}
            target={weightTarget}
            mode="decimal"
            allowKinds={['fixed', 'min', 'max']}
            disabled={disabled}
            onChange={(next) =>
              onChange({
                reps: prescription.reps ?? { kind: 'fixed', value: 8 },
                weightKg: next,
              })
            }
          />
        )}
      </div>
    </article>
  )
}
