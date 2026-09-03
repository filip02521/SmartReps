/**
 * Weight unit conversion utilities.
 * Backend always stores kg; UI converts for display/input based on user preference.
 */

const KG_TO_LB = 2.20462262

/** Convert kg → display unit (rounded to 1 decimal for lb). */
export function kgToDisplay(kg: number, unit: 'kg' | 'lb'): number {
  if (unit === 'kg') return kg
  return Math.round(kg * KG_TO_LB * 10) / 10
}

/** Convert display unit input → kg for storage. */
export function displayToKg(value: number, unit: 'kg' | 'lb'): number {
  if (unit === 'kg') return value
  return Math.round((value / KG_TO_LB) * 10) / 10
}

/** Unit label for current preference. */
export function weightUnitLabel(unit: 'kg' | 'lb'): string {
  return unit === 'kg' ? 'kg' : 'lb'
}
