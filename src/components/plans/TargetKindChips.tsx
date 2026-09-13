import { SegmentedControl } from '@/components/ui/SegmentedControl'
import type { MetricTarget } from '@/lib/exercise-model'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import { pl } from '@/i18n/pl'

type TargetKind = MetricTarget['kind']

// Resolved lazily per render — `pl` proxies the active dictionary; a
// module-level map would freeze labels at import-time language.
function kindLabels(compact: boolean): Record<TargetKind, string> {
  return compact
    ? {
        fixed: pl.customTargetKindFixedShort,
        min: pl.customTargetKindMinShort,
        max: pl.customTargetKindMaxShort,
        exact: pl.customTargetKindExactShort,
      }
    : {
        fixed: pl.customTargetKindFixed,
        min: pl.customTargetKindMin,
        max: pl.customTargetKindMax,
        exact: pl.customTargetKindExact,
      }
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
  const labels = kindLabels(size === 'compact')
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
