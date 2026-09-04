import { describe, expect, it } from 'vitest'
import { pl } from '@/i18n/pl'
import { en } from '@/i18n/en'
import type { Translation } from '@/i18n/pl'

/**
 * Extracts all top-level keys from a translation dictionary object literal.
 * Reads the source file to avoid proxy resolution issues.
 */
function getTranslationKeys(obj: Translation): string[] {
  return Object.keys(obj).sort()
}

/**
 * Extracts function keys and their parameter signatures from a translation object.
 * Returns a map of key -> parameter names joined by comma.
 */
function getFunctionSignatures(obj: Translation): Record<string, string> {
  const sigs: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'function') {
      const fnStr = value.toString()
      // Extract param list from function signature: (a, b) => ... or function(a, b) { ... }
      const match = fnStr.match(/\(([^)]*)\)/)
      const params = match ? match[1].replace(/\s/g, '').replace(/=[^,)]+/g, '') : ''
      sigs[key] = params
    }
  }
  return sigs
}

describe('i18n key parity (pl vs en)', () => {
  it('every key in pl.ts exists in en.ts', () => {
    const plKeys = getTranslationKeys(pl)
    const enKeys = getTranslationKeys(en)
    const missingInEn = plKeys.filter((k) => !enKeys.includes(k))
    expect(missingInEn, `Keys missing in en.ts: ${missingInEn.join(', ')}`).toEqual([])
  })

  it('every key in en.ts exists in pl.ts', () => {
    const plKeys = getTranslationKeys(pl)
    const enKeys = getTranslationKeys(en)
    const missingInPl = enKeys.filter((k) => !plKeys.includes(k))
    expect(missingInPl, `Keys missing in pl.ts: ${missingInPl.join(', ')}`).toEqual([])
  })

  it('pl and en have the same number of keys', () => {
    const plKeys = getTranslationKeys(pl)
    const enKeys = getTranslationKeys(en)
    expect(enKeys.length, `pl has ${plKeys.length} keys, en has ${enKeys.length}`).toBe(plKeys.length)
  })
})

describe('i18n function signature parity (pl vs en)', () => {
  it('every function key in pl has matching params in en', () => {
    const plSigs = getFunctionSignatures(pl)
    const enSigs = getFunctionSignatures(en)

    const plFuncKeys = Object.keys(plSigs).sort()
    const enFuncKeys = Object.keys(enSigs).sort()

    // Same set of function keys
    const missingFuncsInEn = plFuncKeys.filter((k) => !(k in enSigs))
    expect(missingFuncsInEn, `Functions missing in en.ts: ${missingFuncsInEn.join(', ')}`).toEqual([])

    const missingFuncsInPl = enFuncKeys.filter((k) => !(k in plSigs))
    expect(missingFuncsInPl, `Functions missing in pl.ts: ${missingFuncsInPl.join(', ')}`).toEqual([])

    // Same param signatures
    const mismatches: string[] = []
    for (const key of plFuncKeys) {
      if (enSigs[key] && plSigs[key] !== enSigs[key]) {
        mismatches.push(`${key}: pl(${plSigs[key]}) vs en(${enSigs[key]})`)
      }
    }
    expect(mismatches, `Signature mismatches:\n${mismatches.join('\n')}`).toEqual([])
  })
})

describe('i18n type safety', () => {
  it('en satisfies the Translation type from pl', () => {
    // If en didn't match Translation, TypeScript would fail at compile time.
    // This runtime check ensures the import works and en is not empty.
    expect(Object.keys(en).length).toBeGreaterThan(100)
    expect(typeof en.appName).toBe('string')
  })
})
