import type {
  MetricTarget,
  PrimaryMetric,
  SetActual,
  SetPrescription,
} from '@/lib/exercise-model'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import { pl } from '@/i18n/pl'

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

/** Checklist cell: "12", "45s", "8 · 40kg". */
export function formatPrescriptionTarget(
  prescription: SetPrescription,
  metric: PrimaryMetric,
): string {
  if (metric === 'duration_sec' && prescription.durationSec) {
    return `${formatMetricTarget(prescription.durationSec)}s`
  }
  if (prescription.reps) {
    const reps = formatMetricTarget(prescription.reps)
    if (metric === 'reps_weight' && prescription.weightKg) {
      return `${reps} · ${formatMetricTarget(prescription.weightKg)}kg`
    }
    return reps
  }
  if (prescription.durationSec) {
    return `${formatMetricTarget(prescription.durationSec)}s`
  }
  return '—'
}

/** Overline above the big number — mirrors getSetLabel for builtins. */
export function formatPrescriptionSetLabel(
  prescription: SetPrescription,
  metric: PrimaryMetric,
  exerciseName: string,
): string {
  if (metric === 'duration_sec' && prescription.durationSec) {
    const n = metricTargetDisplayValue(prescription.durationSec)
    return pl.customSetLabelDuration(n, exerciseName)
  }
  if (prescription.reps) {
    const n = metricTargetDisplayValue(prescription.reps)
    if (metric === 'reps_weight') {
      const kg = prescription.weightKg
        ? metricTargetDisplayValue(prescription.weightKg)
        : null
      return kg != null
        ? pl.customSetLabelRepsWeight(n, kg, exerciseName)
        : pl.customSetLabelReps(n, exerciseName)
    }
    return pl.customSetLabelReps(n, exerciseName)
  }
  return exerciseName
}

export function formatSetActualDisplay(
  actual: SetActual,
  metric: PrimaryMetric,
): string {
  if (metric === 'duration_sec') {
    return `${actual.durationSec ?? 0}s`
  }
  if (metric === 'reps_weight') {
    const reps = actual.reps ?? 0
    if (actual.weightKg != null) return `${reps} · ${actual.weightKg}kg`
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
