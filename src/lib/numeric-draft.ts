/** Draft helpers for clearable numeric inputs (PL comma decimals supported). */

export type NumericInputMode = 'integer' | 'decimal'

export function formatNumericDisplay(value: number, mode: NumericInputMode): string {
  if (!Number.isFinite(value)) return ''
  if (mode === 'integer') return String(Math.trunc(value))
  // Prefer comma for Polish users typing weight.
  return String(value).replace('.', ',')
}

/** Keep only digits while typing an integer (empty allowed). */
export function normalizeIntegerDraft(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * Allow digits + one decimal separator (`.` or `,`).
 * Preserves a trailing separator so "12," can become "12,5".
 */
export function normalizeDecimalDraft(raw: string): string {
  const cleaned = raw.replace(/[^\d.,]/g, '')
  let sepSeen = false
  let out = ''
  for (const ch of cleaned) {
    if (ch === '.' || ch === ',') {
      if (sepSeen) continue
      sepSeen = true
      out += ','
      continue
    }
    out += ch
  }
  return out
}

export function parseIntegerDraft(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

export function parseDecimalDraft(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (!t || t === '.') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export function normalizeNumericDraft(raw: string, mode: NumericInputMode): string {
  return mode === 'integer' ? normalizeIntegerDraft(raw) : normalizeDecimalDraft(raw)
}

export function parseNumericDraft(raw: string, mode: NumericInputMode): number | null {
  return mode === 'integer' ? parseIntegerDraft(raw) : parseDecimalDraft(raw)
}

/** Commit draft on blur; empty → fallback (usually 0). */
export function commitNumericDraft(
  raw: string,
  mode: NumericInputMode,
  opts?: { min?: number; max?: number; emptyValue?: number },
): number {
  const min = opts?.min ?? 0
  const emptyValue = opts?.emptyValue ?? min
  const parsed = parseNumericDraft(raw, mode)
  let n = parsed == null ? emptyValue : parsed
  if (opts?.max != null) n = Math.min(opts.max, n)
  return Math.max(min, n)
}
