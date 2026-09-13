import { describe, expect, it } from 'vitest'
import { parseCoachBody, hasCoachSections, coachBodyPreview } from '@/lib/coach-body'

describe('parseCoachBody', () => {
  it('parses structured weekly-report body into sections', () => {
    const body = [
      'Dobry tydzień, 3 treningi.',
      '',
      '✓ Regularność; Progres w przysiadzie',
      '',
      '→ Za mało objętości na plecy',
      '',
      '💡 Dodaj jedno wiosłowanie w środę',
    ].join('\n')
    const parsed = parseCoachBody(body)
    expect(parsed.summary).toBe('Dobry tydzień, 3 treningi.')
    expect(parsed.strengths).toEqual(['Regularność', 'Progres w przysiadzie'])
    expect(parsed.improvements).toEqual(['Za mało objętości na plecy'])
    expect(parsed.recommendation).toBe('Dodaj jedno wiosłowanie w środę')
  })

  it('puts plain fallback text entirely into summary', () => {
    const body = 'Pierwszy trening w programie.\nKolejne sesje pokażą postęp.'
    const parsed = parseCoachBody(body)
    expect(parsed.summary).toBe(body)
    expect(parsed.strengths).toEqual([])
    expect(parsed.improvements).toEqual([])
    expect(parsed.recommendation).toBeNull()
  })

  it('strips 💡 surrogate pair correctly (no leftover half-emoji)', () => {
    const parsed = parseCoachBody('💡 Więcej odpoczynku')
    expect(parsed.recommendation).toBe('Więcej odpoczynku')
    // No lone UTF-16 surrogate may remain after stripping the marker
    expect(parsed.recommendation).not.toMatch(/[\uD800-\uDFFF]/)
  })

  it('handles markers without following space', () => {
    const parsed = parseCoachBody('✓Siła rośnie\n→Tempo')
    expect(parsed.strengths).toEqual(['Siła rośnie'])
    expect(parsed.improvements).toEqual(['Tempo'])
  })

  it('handles empty body', () => {
    const parsed = parseCoachBody('')
    expect(parsed.summary).toBe('')
    expect(parsed.strengths).toEqual([])
    expect(parsed.recommendation).toBeNull()
  })
})

describe('hasCoachSections', () => {
  it('detects marker lines anywhere in the body', () => {
    expect(hasCoachSections('Intro\n\n✓ Dobrze')).toBe(true)
    expect(hasCoachSections('Plain text only.')).toBe(false)
    expect(hasCoachSections('')).toBe(false)
  })
})

describe('coachBodyPreview', () => {
  it('returns first summary line for structured bodies', () => {
    const body = 'Linia pierwsza.\nLinia druga.\n\n✓ Coś'
    expect(coachBodyPreview(body)).toBe('Linia pierwsza.')
  })

  it('falls back to a section item (never raw markers) when summary is empty', () => {
    expect(coachBodyPreview('✓ Tylko sekcja')).toBe('Tylko sekcja')
    expect(coachBodyPreview('✓ a; b\n→ c')).toBe('a')
    expect(coachBodyPreview('💡 Rekomendacja')).toBe('Rekomendacja')
  })

  it('collapses whitespace', () => {
    expect(coachBodyPreview('  tekst   z   spacjami  ')).toBe('tekst z spacjami')
  })
})
