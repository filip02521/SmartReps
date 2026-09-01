import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { MetricTarget } from '@/lib/exercise-model'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import { pl } from '@/i18n/pl'

type TargetKind = MetricTarget['kind']

const KIND_LABELS: Record<TargetKind, string> = {
  fixed: pl.customTargetKindFixed,
  min: pl.customTargetKindMin,
  max: pl.customTargetKindMax,
  exact: pl.customTargetKindExact,
}

const KIND_LABELS_COMPACT: Record<TargetKind, string> = {
  fixed: pl.customTargetKindFixedShort,
  min: pl.customTargetKindMinShort,
  max: pl.customTargetKindMaxShort,
  exact: pl.customTargetKindExactShort,
}

export function TargetKindChips({
  target,
  onChange,
  allowKinds = ['fixed', 'min', 'max', 'exact'],
  disabled = false,
  size = 'default',
  className,
}: {
  target: MetricTarget
  onChange: (next: MetricTarget) => void
  allowKinds?: TargetKind[]
  disabled?: boolean
  size?: 'default' | 'compact'
  className?: string
}) {
  const labels = size === 'compact' ? KIND_LABELS_COMPACT : KIND_LABELS
  const options = allowKinds.map((kind) => ({ value: kind, label: labels[kind] }))
  const kind = target.kind

  return (
    <SegmentedControl
      className={className}
      disabled={disabled}
      size={size}
      value={kind}
      onChange={(nextKind) => {
        const v = metricTargetDisplayValue(target)
        if (nextKind === 'max') onChange({ kind: 'max', minValue: v })
        else onChange({ kind: nextKind, value: v })
      }}
      options={options}
    />
  )
}
