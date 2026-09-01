import { describe, expect, it } from 'vitest'
import {
  formatMetricTarget,
  formatPrescriptionSetLabel,
  formatPrescriptionTarget,
  formatSetActualDisplay,
} from '@/lib/custom-prescription-format'

describe('custom-prescription-format', () => {
  it('formats fixed / max / exact targets', () => {
    expect(formatMetricTarget({ kind: 'fixed', value: 12 })).toBe('12')
    expect(formatMetricTarget({ kind: 'max', minValue: 8 })).toContain('8')
    expect(formatMetricTarget({ kind: 'exact', value: 5 })).toContain('5')
  })

  it('formats prescription cells by metric', () => {
    expect(
      formatPrescriptionTarget({ reps: { kind: 'fixed', value: 10 } }, 'reps'),
    ).toBe('10')
    expect(
      formatPrescriptionTarget({ durationSec: { kind: 'fixed', value: 45 } }, 'duration_sec'),
    ).toBe('45s')
    expect(
      formatPrescriptionTarget(
        { reps: { kind: 'fixed', value: 8 }, weightKg: { kind: 'fixed', value: 40 } },
        'reps_weight',
      ),
    ).toBe('8 · 40kg')
  })

  it('builds overline labels', () => {
    expect(
      formatPrescriptionSetLabel(
        { reps: { kind: 'fixed', value: 10 } },
        'reps',
        'Pompki',
      ),
    ).toContain('Pompki')
    expect(
      formatPrescriptionSetLabel(
        { durationSec: { kind: 'fixed', value: 30 } },
        'duration_sec',
        'Deska',
      ),
    ).toContain('30')
  })

  it('formats logged actuals', () => {
    expect(formatSetActualDisplay({ reps: 9 }, 'reps')).toBe('9')
    expect(formatSetActualDisplay({ durationSec: 40 }, 'duration_sec')).toBe('40s')
    expect(formatSetActualDisplay({ reps: 5, weightKg: 20 }, 'reps_weight')).toBe('5 · 20kg')
  })

  it('detects exact and max prescriptions', async () => {
    const { isExactPrescription, isMaxPrescription } = await import(
      '@/lib/custom-prescription-format'
    )
    expect(
      isExactPrescription({ reps: { kind: 'exact', value: 5 } }, 'reps'),
    ).toBe(true)
    expect(
      isMaxPrescription({ reps: { kind: 'max', minValue: 8 } }, 'reps'),
    ).toBe(true)
  })
})
