import type {
  MetricTarget,
  PrimaryMetric,
  SetActual,
  SetPrescription,
} from '@/lib/exercise-model'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import { pl } from '@/i18n/pl'

/** Duration display unit — 'sec' (default) or 'min' for cardio-style exercises. */
export type DurationUnit = 'sec' | 'min'

/** Convert seconds to the display unit value. */
export function secToDisplay(sec: number, unit: DurationUnit): number {
  if (unit === 'min') return Math.round(sec / 60)
  return sec
}

/** Convert a display-unit value back to seconds. */
export function displayToSec(display: number, unit: DurationUnit): number {
  if (unit === 'min') return Math.round(display * 60)
  return display
}

/** Format a duration in seconds for display, respecting the unit.
 *  sec: "45s", "60s"
 *  min: "40 min", "1 min" */
export function formatDurationDisplay(sec: number, unit: DurationUnit): string {
  if (unit === 'min') {
    const mins = Math.round(sec / 60)
    return pl.durationMinValue(mins)
  }
  return pl.durationSecValue(sec)
}

export function formatMetricTarget(target: MetricTarget): string {
  switch (target.kind) {
    case 'fixed':
    case 'min':
      return String(target.value)
    case 'exact':
      return pl.formatSetExact(target.value)
    case 'max':
      return pl.formatSetMax(target.minValue)
  }
}

export function formatMetricTargetCompact(target: MetricTarget): string {
  switch (target.kind) {
    case 'fixed':
    case 'min':
      return String(target.value)
    case 'exact':
      return pl.formatSetExactShort(target.value)
    case 'max':
      return pl.formatSetMaxShort(target.minValue)
  }
}

/** Checklist cell: "12", "45s", "40 min", "8 · 40kg". */
export function formatPrescriptionTarget(
  prescription: SetPrescription,
  metric: PrimaryMetric,
  weightUnit: 'kg' | 'lb' = 'kg',
  durationUnit: DurationUnit = 'sec',
): string {
  if (metric === 'duration_sec' && prescription.durationSec) {
    const sec = metricTargetDisplayValue(prescription.durationSec)
    return formatDurationDisplay(sec, durationUnit)
  }
  if (prescription.reps) {
    const reps = formatMetricTarget(prescription.reps)
    if (metric === 'reps_weight' && prescription.weightKg) {
      const kg = metricTargetDisplayValue(prescription.weightKg)
      return `${reps} · ${kgToDisplay(kg, weightUnit)}${weightUnitLabel(weightUnit)}`
    }
    return reps
  }
  if (prescription.durationSec) {
    const sec = metricTargetDisplayValue(prescription.durationSec)
    return formatDurationDisplay(sec, durationUnit)
  }
  return '—'
}

/** Overline above the big number — mirrors getSetLabel for builtins. */
export function formatPrescriptionSetLabel(
  prescription: SetPrescription,
  metric: PrimaryMetric,
  exerciseName: string,
  weightUnit: 'kg' | 'lb' = 'kg',
  durationUnit: DurationUnit = 'sec',
): string {
  if (metric === 'duration_sec' && prescription.durationSec) {
    const sec = metricTargetDisplayValue(prescription.durationSec)
    if (durationUnit === 'min') {
      const mins = Math.round(sec / 60)
      return pl.customSetLabelDurationMin(mins, exerciseName)
    }
    return pl.customSetLabelDuration(sec, exerciseName)
  }
  if (prescription.reps) {
    const n = metricTargetDisplayValue(prescription.reps)
    if (metric === 'reps_weight') {
      const kg = prescription.weightKg
        ? metricTargetDisplayValue(prescription.weightKg)
        : null
      if (kg != null) {
        const disp = kgToDisplay(kg, weightUnit)
        return pl.customSetLabelRepsWeight(n, disp, weightUnitLabel(weightUnit), exerciseName)
      }
      return pl.customSetLabelReps(n, exerciseName)
    }
    return pl.customSetLabelReps(n, exerciseName)
  }
  return exerciseName
}

export function formatSetActualDisplay(
  actual: SetActual,
  metric: PrimaryMetric,
  weightUnit: 'kg' | 'lb' = 'kg',
  durationUnit: DurationUnit = 'sec',
): string {
  if (metric === 'duration_sec') {
    return formatDurationDisplay(actual.durationSec ?? 0, durationUnit)
  }
  if (metric === 'reps_weight') {
    const reps = actual.reps ?? 0
    if (actual.weightKg != null) {
      const disp = kgToDisplay(actual.weightKg, weightUnit)
      return `${reps} · ${disp}${weightUnitLabel(weightUnit)}`
    }
    return String(reps)
  }
  return String(actual.reps ?? 0)
}

export function primaryActualNumber(
  actual: SetActual,
  metric: PrimaryMetric,
): number {
  if (metric === 'duration_sec') return actual.durationSec ?? 0
  return actual.reps ?? 0
}

export function getPrimaryMetricTarget(
  prescription: SetPrescription,
  metric: PrimaryMetric,
): MetricTarget | undefined {
  if (metric === 'duration_sec') return prescription.durationSec
  return prescription.reps
}

export function isExactPrescription(
  prescription: SetPrescription,
  metric: PrimaryMetric,
): boolean {
  return getPrimaryMetricTarget(prescription, metric)?.kind === 'exact'
}

export function isMaxPrescription(
  prescription: SetPrescription,
  metric: PrimaryMetric,
): boolean {
  return getPrimaryMetricTarget(prescription, metric)?.kind === 'max'
}
