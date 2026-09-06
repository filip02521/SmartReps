/**
 * Sanitize a numeric value at a service boundary.
 * Coerces strings to numbers, rejects NaN/Infinity, clamps to [min, max].
 * Returns `fallback` if the value is not a finite number.
 */
export function sanitizeNumber(
  value: unknown,
  options: { min?: number; max?: number; fallback?: number } = {},
): number {
  const { min, max, fallback = 0 } = options
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  let result = n
  if (typeof min === 'number') result = Math.max(min, result)
  if (typeof max === 'number') result = Math.min(max, result)
  return result
}

/** Sanitize a reps/count value — must be a non-negative finite integer. */
export function sanitizeReps(value: unknown, max = 9999): number {
  return Math.round(sanitizeNumber(value, { min: 0, max, fallback: 0 }))
}

/** Sanitize a weight value — must be a non-negative finite number. */
export function sanitizeWeight(value: unknown, max = 10000): number {
  return sanitizeNumber(value, { min: 0, max, fallback: 0 })
}

/** Sanitize a duration in seconds — must be a non-negative finite integer. */
export function sanitizeDurationSec(value: unknown, max = 86400): number {
  return Math.round(sanitizeNumber(value, { min: 0, max, fallback: 0 }))
}
